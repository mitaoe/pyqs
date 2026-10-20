import { expect, test } from "@playwright/test"

const STATIC_PAGES = [
  "/",
  "/papers",
  "/papers?subject=Computer%20Networks",
  "/papers?subject=Introduction%20to%20Industrial%20IOT%204.0",
  "/api/papers",
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
  for (const value of ["100%25", "a%3Fb", "a%23b"]) {
    const html = await (await request.get(`/papers?subject=${value}`)).text()
    expect(html).toContain("Find Your Papers")
  }
})
