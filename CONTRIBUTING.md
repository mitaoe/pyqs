# Contributing

Thanks for helping students find their papers. This covers running the app locally, the checks a pull request has to pass, and regenerating paper data. For how the code is organised, read [AGENTS.md](AGENTS.md) first.

## Contents

- [Setup](#setup)
- [Checks](#checks)
- [Generating paper data](#generating-paper-data)
- [Pull requests](#pull-requests)

## Setup

Requires Node.js 22 and pnpm 10.

```bash
git clone https://github.com/mitaoe/pyqs.git
cd pyqs
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

## Checks

```bash
pnpm lint           # ESLint and Prettier
pnpm type-check
pnpm test           # unit tests; MONGODB_TEST_URI=mongodb://localhost:27017/pyqs-test adds the MongoDB tests
pnpm test:e2e       # builds the app and runs Playwright on :3000
```

CI runs all of them on every pull request.

## Generating paper data

```bash
pnpm pyq-gen                   # crawl the college server and write the catalog to MongoDB
pnpm pyq-gen --test --verbose  # crawl only a test directory, with detailed logs
pnpm pyq-gen --interactive     # review each subject match as it is classified
pnpm crawl                     # directory data for /browse (add --debug for logs)
```

You may see 400 errors for E&TC directories while generating; those are expected. New subjects appear on the site at the next deploy, or within a day through revalidation.

## Pull requests

- Branch from `main` and keep each pull request to one change.
- Titles follow Conventional Commits, for example `fix(papers): keep filters when switching view`.
- Describe what changed, why, and how you verified it.
- UI changes need a before/after screenshot. The current UI is the reference; changes to it are agreed in an issue first.
