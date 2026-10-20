import { test as base, expect, type Page } from "@playwright/test"

export const SUBJECT = "Computer Networks"
export const SUBJECT_URL = `/papers?subject=${encodeURIComponent(SUBJECT)}`
export const SUBJECT_PAPER_COUNT = 60

export const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")

const CORS = { "access-control-allow-origin": "*" }

interface Storage {
  isUp: boolean
  requests: string[]
}

export const test = base.extend<{ storage: Storage; appRequests: string[] }>({
  storage: [
    async ({ page }, use) => {
      const storage: Storage = { isUp: true, requests: [] }

      await page.route(
        (url) => url.hostname !== "localhost",
        async (route) => {
          const url = route.request().url()
          storage.requests.push(url)
          if (url.startsWith("https://mozilla.github.io/pdf.js/")) {
            return route.fulfill({ contentType: "text/html", body: "<p>pdf.js viewer</p>" })
          }
          if (!storage.isUp) return route.fulfill({ status: 503, headers: CORS, body: "down" })
          return route.fulfill({ contentType: "application/pdf", headers: CORS, body: PDF_BYTES })
        },
      )

      await use(storage)
    },
    { auto: true },
  ],

  appRequests: async ({ page }, use) => {
    const requests: string[] = []
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (url.hostname === "localhost") requests.push(url.pathname + url.search)
    })
    await use(requests)
  },

  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem("cursor-style", "default")
      if (!sessionStorage.getItem("keep-tutorial")) {
        localStorage.setItem("papers_select_tutorial_seen", "true")
      }
    })
    await use(page)
  },
})

export { expect }

export const paperCards = (page: Page) => page.locator("[data-paper-file]")

export async function openSubject(page: Page, url = SUBJECT_URL) {
  await page.goto(url)
  await expect(paperCards(page).first()).toBeVisible()
}
