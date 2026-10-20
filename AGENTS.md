# MITAoE PYQs

Previous-year question papers for MIT Academy of Engineering. Next.js App Router on Vercel (Hobby), PDFs on Cloudflare R2 behind the worker in `worker/`, catalog data in MongoDB written by `pnpm pyq-gen`.

## How a request is served

- `/` and `/papers` are static. `/papers` gets the subject list from the catalog at build time.
- `/papers?subject=X` is rewritten in `next.config.ts` to `/papers/[...subject]`, which is prerendered for every subject in `generateStaticParams`. The rewrite only accepts a value that is a single safe path segment (no `/`, `%`, `?`, `#`, `.` or `..`); anything else falls through to the subject list. Unknown subjects and other spellings render once on first visit, are cached, and are marked `noindex`.
- In the browser, opening a subject navigates to `/papers/<subject>` (so the router fetches the prerendered page) and `usePublicSubjectUrl` puts `/papers?subject=X` back in the address bar. Links people share keep the original format.
- Catalog pages and `/api/papers` revalidate daily (`export const revalidate = 86400`, mirrored in `CATALOG_REVALIDATE_SECONDS`). Each revalidation is one function invocation and one MongoDB query per visited page per day; Vercel does not charge ISR writes when the output is unchanged, so writes only happen when the data changes. Visitors themselves never cause a database read on prerendered pages; the first visit to a `?subject=` value that was not prerendered costs one function invocation, one MongoDB query and one cache entry.
- `/papers` and `/papers/[...subject]` share `src/app/papers/layout.tsx`, so the page transition and the toaster stay mounted while moving between the list and a subject, as they did before.
- The build reads MongoDB (`generateStaticParams`), so `MONGODB_URI` must be reachable from Vercel's build machines. If it is not, the build fails and the previous deployment keeps serving.
- PDFs go straight from the browser to the storage worker. They never pass through Vercel.

## Where things live

```
src/
  app/                 routes only: layouts, pages, route handlers, providers.tsx
  features/
    catalog/           paper and subject domain: types, pure selectors, metadata
      server/          catalog sources (MongoDB, JSON file) and the cached getters pages call
    subject-index/     /papers: A–Z bar, search box, subject list
    subject-papers/    a subject's papers: toolbar, filters, selection, grid/list, batch download
    downloads/         single and ZIP downloads, IndexedDB PDF cache
    pdf-viewer/        preview dialog (hosted PDF.js)
    server-status/     paper storage health check and banner
    settings/          theme, cursor, clear cache
    home/              landing hero
    directory-browser/ /browse (developer only, depends on the college server)
  components/          UI shared across features: layout, animations
  lib/                 framework-free helpers: fetch timeout, storage, MongoDB connection
  config/              site constants and PDF URLs
  models/ types/ utils/SubjectManager.ts config/mappings.ts
                       shared with the ingestion scripts in src/scripts
```

A feature owns its components, hooks and logic. Code used by two features moves to `components/` or `lib/`; domain logic used by several features belongs in `features/catalog`. Route files stay thin and compose features.

`src/scripts`, `src/models`, `src/types/paper.ts`, `src/utils/SubjectManager.ts` and `src/config/mappings.ts` are used by `pnpm crawl` and `pnpm pyq-gen`. Change them only together with the scripts.

## Free-tier budget

The app is built to stay inside Vercel Hobby and Cloudflare free limits for thousands of students:

- Keep catalog pages static. Do not read `searchParams`, cookies or headers in a catalog page; that makes it dynamic and every visit becomes a function invocation.
- Do not let `<Link>` prefetch long lists on render. Subject buttons prefetch on hover, touch and focus through `useSubjectNavigation`.
- Do not proxy PDFs through Next.js. Requests to the storage worker count against the worker's 100,000 requests per day, so avoid extra ones (no range requests, no polling).

## Commands

```bash
pnpm dev           # http://localhost:3000
pnpm build
pnpm lint          # ESLint + Prettier check
pnpm format
pnpm type-check
pnpm test          # Vitest; set MONGODB_TEST_URI to include the MongoDB contract test
pnpm test:e2e      # Playwright against a production build on :3000
```

Without database access, use a saved catalog: `curl -o catalog.json https://mitaoe-pyqs.vercel.app/api/papers` and run with `CATALOG_FILE=catalog.json`. Tests use `tests/fixtures/catalog.json`, a five-subject slice of real data.

## Conventions

- Prettier owns formatting (100 columns, no semicolons). CI fails on unformatted code, lint warnings, type errors and failing tests.
- No comments that restate what the code does. Name things so they don't need it.
- E2E tests intercept every request that leaves localhost; they must never reach real paper storage.
- Keep the UI pixel-identical unless a change is agreed first.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
