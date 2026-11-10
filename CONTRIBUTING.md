# Contributing

Thanks for helping students find their papers. This covers how a change gets from an idea to `main`, running the app locally, the checks a pull request has to pass, regenerating paper data, and what a pull request should look like. For how the code is organised, read [AGENTS.md](AGENTS.md) first.

## Contents

- [How a contribution flows](#how-a-contribution-flows)
- [Setup](#setup)
- [Checks](#checks)
- [Generating paper data](#generating-paper-data)
- [Pull requests](#pull-requests)

## How a contribution flows

1. **Open an issue.** Open an issue before you start work, one for each concern, describing the problem or the feature. Changes to the UI are agreed in the issue first; the current UI is the reference.
2. **Fork and branch.** Fork the repository and branch from `main`, naming the branch `<username>/<short-slug>`, for example `<username>/keep-filters`. Keep a pull request to one concern; it resolves several issues only when they are the same change. When one change is split over several pull requests, only the last one uses `Closes`; the earlier ones say `Part of #N`.
3. **Open a pull request** from your branch to `main` on mitaoe/pyqs, written as described in [Pull requests](#pull-requests).
4. **Let CI run.** CI on a pull request from anyone outside the mitaoe organisation who is not a collaborator on the repository waits until a maintainer approves it. The four [checks](#checks) must pass before the pull request can be merged.
5. **Work through the review.** A maintainer reviews the pull request and may ask for changes. Push them to the same branch with `git push`. To pick up newer changes on `main`, run `git fetch upstream` and `git rebase upstream/main`, then `git push --force-with-lease`, rather than merging `main` in.
6. **Merge.** Squash is the only merge method the repository and its `main` ruleset allow. The pull request title becomes the commit subject on `main` and the commit body is left blank, so the title has to describe everything the pull request does.

Issues and pull requests with no activity for 7 days are labelled `stale` and closed 30 days later; a comment removes the label at the next run. Items labelled `pinned`, `security`, `help wanted` or `good first issue` are never marked or closed, and neither are pull requests labelled `dependencies`, which Dependabot adds to its own; a `stale` label already on an item stays until it is removed by hand.

## Setup

Requires Node.js 22 and pnpm 10.

Fork the repository on GitHub, then:

```bash
git clone https://github.com/<your-username>/pyqs.git
cd pyqs
git remote add upstream https://github.com/mitaoe/pyqs.git
pnpm install
cp .env.example .env
```

Then either set `MONGODB_URI` in `.env`, or skip the database and use a copy of the live catalog:

```bash
curl -o catalog.json https://mitaoe-pyqs.vercel.app/api/papers
echo "CATALOG_FILE=catalog.json" >> .env
```

```bash
pnpm dev            # http://localhost:3000
```

Start each change on a new branch from the latest `main`:

```bash
git fetch upstream
git switch -c <username>/keep-filters upstream/main
```

The new branch starts out tracking `upstream/main`, so a plain `git push` does not reach your fork. After your first commit, publish the branch to your fork:

```bash
git push -u origin HEAD
```

From then on, `git push` updates the branch and its pull request.

## Checks

```bash
pnpm lint           # ESLint and Prettier
pnpm type-check
pnpm test           # unit tests; MONGODB_TEST_URI=mongodb://localhost:27017/pyqs-test adds the MongoDB tests
pnpm test:e2e       # builds the app and runs Playwright on :3000
```

CI runs all of them on every pull request, and each one is a required check:

| Check                 | Command           |
| --------------------- | ----------------- |
| TypeScript Type Check | `pnpm type-check` |
| ESLint                | `pnpm lint`       |
| Unit Tests            | `pnpm test`       |
| E2E Tests             | `pnpm test:e2e`   |

`pnpm lint` reports no errors and no warnings on `main`. Warnings don't fail CI, so check the output and keep it at zero.

## Generating paper data

```bash
pnpm pyq-gen                   # crawl the college server and write the catalog to MongoDB
pnpm pyq-gen --test --verbose  # crawl only a test directory, with detailed logs
pnpm pyq-gen --interactive     # review each subject match as it is classified
pnpm crawl                     # directory data for /browse (add --debug for logs)
```

You may see 400 errors for E&TC directories while generating; those are expected. New subjects appear on the site at the next deploy, or within a day through revalidation.

## Pull requests

- Branch names follow `<username>/<short-slug>`.
- Titles follow [Conventional Commits](https://www.conventionalcommits.org/) with a scope, for example `fix(papers): keep filters when switching view`. The title is the commit subject on `main`.
- The description has four sections, in order: Overview, which ends with one `Closes #N` line for each issue it resolves, What this changes, Not addressed here and Verification.
  - **Overview**: the problem and why it matters, then the `Closes #N` lines. GitHub closes those issues when the pull request merges, so a pull request that is only part of a split change says `Part of #N` instead.
  - **What this changes**: what is different once the pull request lands.
  - **Not addressed here**: related problems you noticed and left out, and why.
  - **Verification**: the checks you ran and what you tested by hand, with the results.
- UI changes need before/after screenshots. The current UI is the reference; changes to it are agreed in an issue first.
