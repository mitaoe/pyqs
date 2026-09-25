"""Question extraction from paper text via Gemini Flash.

Every call goes through the KeyManager pool (never the reserved runtime
key). JSON output is forced via responseMimeType; a parse failure is logged
and retried ONCE with a repair prompt per the quality gates. The REST API is
used directly so per-call key rotation stays trivial.
"""

import json
import logging
import re
import time

import requests

import config

log = logging.getLogger(__name__)

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

EXTRACTION_PROMPT = """\
You are extracting exam questions from the raw text of a university question paper.

Return ONLY a JSON array. Each element must be an object with exactly these keys:
  "question_text": string  — the complete text of one individual question
  "marks": integer or null — the marks allotted to it, if stated
  "sub_question_label": string or null — its label like "Q1a", "2(b)", if present

Rules:
- Extract EVERY individual question and sub-question as its own element.
- Clean numbering artifacts out of question_text, but never paraphrase or shorten it.
- Do NOT include instructions, headers, course/exam metadata, or page furniture.
- Do NOT invent questions that are not in the text.
- If the text contains no questions, return [].

Paper text follows:
"""

REPAIR_PROMPT = """\
The following text was supposed to be a JSON array of objects with keys
"question_text", "marks", "sub_question_label", but it failed to parse.
Return ONLY the corrected, valid JSON array — no commentary, no markdown.

"""

# Key indexes whose first 429 body has already been dumped this run, so the
# log carries one full raw error per key for diagnosis without drowning in
# repeats.
_logged_quota_keys = set()

# Minimal-thinking ladder for generationConfig.thinkingConfig. Gemini 3.x are
# thinking models; extraction needs throughput, not reasoning. Per the API
# docs (ai.google.dev/gemini-api/docs/gemini-3): Gemini 3 controls thinking
# via thinkingLevel (minimal|low|medium|high; "minimal" exists only on
# 3 Flash / 3.1 Flash-Lite), the legacy thinkingBudget is still accepted on
# some models for backward compatibility, and a request must never carry
# both. We start from the cheapest setting and step down on a 400 rejection
# until the model accepts one; the choice then sticks for the whole run.
_THINKING_FALLBACKS = [
    {"thinkingBudget": 0},         # thinking fully off, where still accepted
    {"thinkingLevel": "minimal"},  # lowest level on 3 Flash / 3.1 Flash-Lite
    {"thinkingLevel": "low"},      # lowest level on other Gemini 3 models
    None,                          # give up; use the model's default
]
_thinking_idx = 0


LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiError(Exception):
    """Permanent failure for this input; the paper is marked failed, run continues."""


class ModelUnusable(Exception):
    """The configured GEMINI_MODEL cannot serve this pipeline at all.

    Rotating keys cannot help, so the whole run must abort loudly and tell
    the operator to fix GEMINI_MODEL (valid ids: GET LIST_MODELS_URL).
    """


class ModelHasNoFreeTier(ModelUnusable):
    """429 with a quota limit of 0: the model is retired or paid-only."""


class ModelNotFound(ModelUnusable):
    """404: the model id does not exist (typo, or removed from the API)."""


def _parse_429(body):
    """Parse a 429 body into (quota_ids, retry_delay_s, limit_zero).

    The API reports structured details (QuotaFailure violations + RetryInfo);
    some variants flatten the same info into the message text, so regex
    fallbacks cover both shapes.
    """
    quota_ids = []
    retry_s = None
    limit_zero = False

    try:
        err = json.loads(body).get("error") or {}
    except (ValueError, AttributeError):
        err = {}
    if not isinstance(err, dict):
        err = {}
    for detail in err.get("details") or []:
        dtype = str(detail.get("@type", ""))
        if dtype.endswith("QuotaFailure"):
            for violation in detail.get("violations") or []:
                qid = str(violation.get("quotaId", ""))
                if qid:
                    quota_ids.append(qid)
                if str(violation.get("quotaValue", "")).strip() == "0":
                    limit_zero = True
        elif dtype.endswith("RetryInfo"):
            m = re.match(r"(\d+)", str(detail.get("retryDelay", "")))
            if m:
                retry_s = int(m.group(1)) + 1

    # \\? tolerates JSON-escaped quotes when the info sits in the message text.
    if not quota_ids:
        quota_ids = re.findall(r'quota_?[iI]d\\?"?\s*:\s*\\?"?([\w.-]+)', body)
    if retry_s is None:
        m = re.search(r'retry_?[dD]elay\\?"?\s*:\s*\\?"?(\d+)', body)
        if m:
            retry_s = int(m.group(1)) + 1
    # A quota limit of 0 means the model has no free tier at all.
    if re.search(r"limit:\s*0\b", body):
        limit_zero = True

    return quota_ids, retry_s, limit_zero


def _call(km, prompt):
    """Send one prompt, rotating keys on rate limits. Returns (text, key_index)."""
    global _thinking_idx
    max_attempts = max(km.pool_size * 2, 4)
    for attempt in range(1, max_attempts + 1):
        idx, key = km.acquire()
        gen_config = {
            "temperature": 0.0,
            "responseMimeType": "application/json",
        }
        if _THINKING_FALLBACKS[_thinking_idx] is not None:
            gen_config["thinkingConfig"] = dict(_THINKING_FALLBACKS[_thinking_idx])
        try:
            resp = requests.post(
                API_URL.format(model=config.GEMINI_MODEL),
                params={"key": key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": gen_config,
                },
                timeout=config.GEMINI_TIMEOUT_S,
            )
        except requests.RequestException as exc:
            log.warning("key[%d] network error (attempt %d): %s", idx, attempt, exc)
            time.sleep(5)
            continue

        if resp.status_code == 200:
            time.sleep(config.GEMINI_CALL_DELAY_S)  # stay under per-minute limits
            try:
                body = resp.json()
                return body["candidates"][0]["content"]["parts"][0]["text"], idx
            except (KeyError, IndexError, TypeError, ValueError) as exc:
                # Empty/blocked candidate: not retryable for this input.
                raise GeminiError(f"unexpected response shape: {exc}") from exc

        if resp.status_code == 429:
            body = resp.text
            if idx not in _logged_quota_keys:
                _logged_quota_keys.add(idx)
                log.warning("key[%d] first quota error this run — raw body: %s", idx, body[:2000])
            quota_ids, retry_s, limit_zero = _parse_429(body)
            if limit_zero:
                log.error(
                    "model %r reports a quota limit of 0 — raw body: %s",
                    config.GEMINI_MODEL, body[:2000],
                )
                raise ModelHasNoFreeTier(
                    f"MODEL HAS NO FREE TIER — check GEMINI_MODEL "
                    f"(currently {config.GEMINI_MODEL!r}) against {LIST_MODELS_URL}"
                )
            if any("perday" in q.lower() for q in quota_ids) or (not quota_ids and "PerDay" in body):
                log.warning(
                    "key[%d] daily quota exhausted (%s)",
                    idx, ", ".join(quota_ids) or "quotaId unparsed",
                )
                km.mark_quota_exhausted(idx)
            else:
                log.warning(
                    "key[%d] per-minute rate limit, cooling down %ss",
                    idx, retry_s or config.RATE_LIMIT_COOLDOWN_S,
                )
                km.mark_rate_limited(idx, retry_s)
            continue

        if resp.status_code == 404:
            log.error(
                "model %r not found — raw body: %s", config.GEMINI_MODEL, resp.text[:500]
            )
            raise ModelNotFound(
                f"MODEL NOT FOUND (HTTP 404) — check GEMINI_MODEL "
                f"(currently {config.GEMINI_MODEL!r}) against {LIST_MODELS_URL}"
            )

        if resp.status_code in (500, 502, 503, 504):
            log.warning("key[%d] server error %d, retrying", idx, resp.status_code)
            time.sleep(5)
            continue

        if resp.status_code in (401, 403):
            log.error("key[%d] rejected (%d) — removing from this run", idx, resp.status_code)
            km.mark_quota_exhausted(idx)
            continue

        if (
            resp.status_code == 400
            and "thinking" in resp.text.lower()
            and _thinking_idx < len(_THINKING_FALLBACKS) - 1
        ):
            rejected = _THINKING_FALLBACKS[_thinking_idx]
            _thinking_idx += 1
            fallback = _THINKING_FALLBACKS[_thinking_idx]
            log.warning(
                "model rejected thinking config %s; falling back to %s — body: %s",
                rejected, fallback if fallback is not None else "model default",
                resp.text[:300],
            )
            continue

        # 400 etc: problem with the request itself, other keys won't help.
        raise GeminiError(f"HTTP {resp.status_code}: {resp.text[:300]}")

    raise GeminiError(f"no successful response after {max_attempts} attempts")


def _parse_questions(raw):
    data = json.loads(raw)
    if isinstance(data, dict):
        # Model occasionally wraps the array in an object; take the first list.
        data = next((v for v in data.values() if isinstance(v, list)), None)
    if not isinstance(data, list):
        raise ValueError("response is not a JSON array")

    out = []
    for item in data:
        if not isinstance(item, dict):
            continue
        text = str(item.get("question_text") or "").strip()
        if len(text) < config.MIN_QUESTION_CHARS:
            continue
        marks = item.get("marks")
        try:
            marks = int(marks) if marks is not None else None
        except (TypeError, ValueError):
            marks = None
        label = item.get("sub_question_label")
        label = (str(label).strip()[:50] or None) if label else None
        out.append({
            "question_text": text[: config.MAX_QUESTION_CHARS],
            "marks": marks,
            "sub_label": label,
        })
    return out


def preflight(km):
    """Validate GEMINI_MODEL with one tiny call before touching any paper.

    A wrong or retired model id fails here in seconds (ModelNotFound /
    ModelHasNoFreeTier) instead of surfacing mid-batch, and the thinking
    fallback ladder settles before real extraction starts.
    """
    log.info("preflight: checking model %r", config.GEMINI_MODEL)
    _, idx = _call(km, 'Reply with the JSON array ["ok"] and nothing else.')
    log.info("preflight passed via key[%d] (model %r)", idx, config.GEMINI_MODEL)


TOPIC_PROMPT = """\
You are labeling university exam questions with short canonical topic names for a study tool.

For EVERY item below, produce a concise topic name (2-6 words, Title Case, no trailing punctuation) naming the concept being tested — like "Infix to Postfix Conversion", "Hashing & Collision Resolution", "Binary Tree Traversals". Use the SAME name for items that test the same concept. Never invent a topic unrelated to the item's text.

Return ONLY a JSON array with one element per input id:
[{"id": 12, "topic": "..."}, ...]

Items:
"""


def _parse_topic_labels(raw, valid_ids):
    data = json.loads(raw)
    if isinstance(data, dict):
        data = next((v for v in data.values() if isinstance(v, list)), None)
    if not isinstance(data, list):
        raise ValueError("response is not a JSON array")
    labels = {}
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            cid = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        topic = str(item.get("topic") or "").strip().rstrip(".")
        if cid in valid_ids and topic:
            labels[cid] = topic[: config.MAX_TOPIC_CHARS]
    return labels


def label_cluster_topics(km, items):
    """Label a batch of (cluster_id, representative_text) with topic names.

    Returns {cluster_id: topic} for the ids Gemini answered; missing ids stay
    unlabeled and are retried on the next run. Raises GeminiError only when
    even the repair prompt fails.
    """
    lines = "\n".join(f'[id {cid}] {text[:400]}' for cid, text in items)
    valid_ids = {cid for cid, _ in items}
    raw, idx = _call(km, TOPIC_PROMPT + lines)
    try:
        labels = _parse_topic_labels(raw, valid_ids)
        log.info("key[%d] labeled %d/%d clusters", idx, len(labels), len(items))
        return labels
    except (ValueError, json.JSONDecodeError) as exc:
        log.warning("topic JSON parse failure (%s); retrying with repair prompt", exc)

    raw2, idx2 = _call(km, REPAIR_PROMPT + raw[: config.MAX_PROMPT_CHARS])
    try:
        labels = _parse_topic_labels(raw2, valid_ids)
        log.info("key[%d] repair prompt recovered %d/%d labels", idx2, len(labels), len(items))
        return labels
    except (ValueError, json.JSONDecodeError) as exc:
        raise GeminiError(f"topic JSON parse failed even after repair: {exc}") from exc


def extract_questions(km, paper_text):
    """Extract questions from one paper's text. Raises GeminiError on permanent failure."""
    raw, idx = _call(km, EXTRACTION_PROMPT + paper_text[: config.MAX_PROMPT_CHARS])
    try:
        questions = _parse_questions(raw)
        log.info("key[%d] extracted %d questions", idx, len(questions))
        return questions
    except (ValueError, json.JSONDecodeError) as exc:
        # Quality gate: log every parse failure, retry once with a repair prompt.
        log.warning("Gemini JSON parse failure (%s); retrying with repair prompt", exc)

    raw2, idx2 = _call(km, REPAIR_PROMPT + raw[: config.MAX_PROMPT_CHARS])
    try:
        questions = _parse_questions(raw2)
        log.info("key[%d] repair prompt recovered %d questions", idx2, len(questions))
        return questions
    except (ValueError, json.JSONDecodeError) as exc:
        raise GeminiError(f"JSON parse failed even after repair: {exc}") from exc
