"""Rotation over the Gemini API key pool.

GEMINI_API_KEYS is a comma-separated list of 1..N free-tier keys, ALL shared
between the pipeline and the runtime app: the runtime rotates per request
with its own cooldown handling, and the pipeline runs briefly on a schedule,
so collisions are acceptable. The pool size is derived from the env var at
runtime — no key count is hardcoded anywhere.

Key *indexes* are logged so calls can be attributed; key values never are.
"""

import logging
import os
import time

import config

log = logging.getLogger(__name__)


class AllKeysExhausted(Exception):
    """Every pool key is cooling down longer than we are willing to wait.

    The caller should stop cleanly; the cron re-run picks the work back up.
    """


class KeyManager:
    # Longest we will sleep waiting for a short (per-minute) cooldown to end.
    # If every key is cooling down beyond this, the run is over for today.
    MAX_WAIT_S = 300

    def __init__(self, keys=None):
        if keys is None:
            raw = os.environ.get("GEMINI_API_KEYS", "")
            keys = [k.strip() for k in raw.split(",") if k.strip()]
        if not keys:
            raise RuntimeError("GEMINI_API_KEYS is not set — see .env.example")
        self._keys = list(keys)  # all keys rotate; the runtime shares them
        self._cooldown_until = [0.0] * len(self._keys)
        self._rr = 0
        log.info("ingestion key pool: %d key(s) (of %d configured)", len(self._keys), len(keys))

    @property
    def pool_size(self):
        return len(self._keys)

    def acquire(self):
        """Return (index, key) of the next usable pool key, round-robin.

        Sleeps through short cooldowns; raises AllKeysExhausted when every
        key is cooling down for longer than MAX_WAIT_S.
        """
        while True:
            now = time.time()
            for offset in range(len(self._keys)):
                i = (self._rr + offset) % len(self._keys)
                if self._cooldown_until[i] <= now:
                    self._rr = (i + 1) % len(self._keys)
                    return i, self._keys[i]
            wait = min(self._cooldown_until) - now
            if wait > self.MAX_WAIT_S:
                raise AllKeysExhausted(
                    f"all {len(self._keys)} pool keys cooling down; "
                    f"soonest is free in {wait / 60:.0f} min"
                )
            log.info("all pool keys cooling down; sleeping %.0fs", wait + 1)
            time.sleep(wait + 1)

    def _cooldown(self, index, seconds):
        until = time.time() + seconds
        self._cooldown_until[index] = max(self._cooldown_until[index], until)
        log.warning("key[%d] cooling down for %ds", index, seconds)

    def mark_rate_limited(self, index, seconds=None):
        """Per-minute 429: short cooldown (honors the API's retryDelay if given)."""
        self._cooldown(index, seconds or config.RATE_LIMIT_COOLDOWN_S)

    def mark_quota_exhausted(self, index):
        """Daily quota hit (or key rejected): key is out for the rest of the run."""
        self._cooldown(index, config.QUOTA_COOLDOWN_S)
