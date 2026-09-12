# PDF storage worker

Cloudflare Worker that serves question papers from the `mitaoe-pyqs` R2 bucket. It is the origin
behind `NEXT_PUBLIC_PDF_BASE_URL`, so PDF bytes never touch the Vercel deployment.

A request path is the R2 object key. `/` returns a liveness string, a missing key returns 404, and a
hit is served as `application/pdf` cached for four hours.

## CORS

`ALLOWED_ORIGINS` in `src/worker.js` is an exact-match allowlist. An origin that is not in it gets an
empty `Access-Control-Allow-Origin`, which the browser rejects. Any origin the site is served from
has to be listed, including `https://mozilla.github.io` — the PDF.js viewer is what fetches the file
when a paper is previewed.

## Deploying

Pushing to `main` with changes under `worker/` deploys through `.github/workflows/worker.yml`, which
runs only in the fork that production is served from and needs the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets there.

To deploy by hand:

```bash
cd worker
npx wrangler deploy
```
