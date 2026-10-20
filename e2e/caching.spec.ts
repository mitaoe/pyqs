import { expect, test } from "@playwright/test"

const STATIC_PAGES = [
  "/",
  "/papers",
  "/papers?subject=Computer%20Networks",
  "/papers?subject=Introduction%20to%20Industrial%20IOT%204.0",
]

for (const path of STATIC_PAGES) {
  test(`${path} is served prerendered and CDN-cacheable`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const cacheControl = response.headers()["cache-control"] ?? ""
    expect(cacheControl).not.toMatch(/private|no-store/)
    if (path !== "/") {
      expect(response.headers()["x-nextjs-cache"]).toBe("HIT")
      expect(cacheControl).toContain("s-maxage=86400")
    }
  })
}

test("/api/papers is prerendered with its original cache headers", async ({ request }) => {
  const response = await request.get("/api/papers")
  const headers = response.headers()
  expect(response.status()).toBe(200)
  expect(headers["x-nextjs-cache"]).toBe("HIT")
  expect(headers["cache-control"]).toBe("public, max-age=604800, s-maxage=2592000")
  expect(headers["cdn-cache-control"]).toBe("max-age=2592000")
  expect(headers["etag"]).toMatch(/^"[0-9a-f]{32}"$/)
})

test("/api/papers keeps its original response shape", async ({ request }) => {
  const body = await (await request.get("/api/papers")).json()
  expect(Object.keys(body)).toEqual(["meta", "lastUpdated", "stats"])
  expect(Object.keys(body.meta)).toEqual([
    "years",
    "branches",
    "examTypes",
    "semesters",
    "subjects",
    "standardSubjects",
    "papers",
  ])
  expect(body.meta.papers.length).toBe(body.stats.totalFiles)
})

test("values that cannot be a path fall back to the subject list", async ({ request }) => {
  for (const value of [
    "100%25",
    "a%3Fb",
    "a%23b",
    "..",
    ".",
    "a%2F..%2Fb",
    "%2FComputer%20Networks",
    "Computer%20Networks%2F",
  ]) {
    const html = await (await request.get(`/papers?subject=${value}`)).text()
    expect(html).toContain("Find Your Papers")
  }
})

test("an unknown subject is a cached 404 that is not indexed", async ({ request }) => {
  for (const path of ["/papers?subject=Not%20A%20Subject", "/papers/Not%20A%20Subject"]) {
    await request.get(path)
    const response = await request.get(path)
    expect(response.status()).toBe(404)
    expect(response.headers()["x-nextjs-cache"]).toBe("HIT")
    expect(await response.text()).toContain('name="robots" content="noindex"')
  }
})
