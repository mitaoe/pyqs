import { readFile } from "node:fs/promises"
import JSZip from "jszip"
import { expect, openSubject, paperCards, PDF_BYTES, test } from "./fixtures"

const visible = "visible=true"

const previewButton = (card: import("@playwright/test").Locator) => card.locator("button").nth(0)
const downloadButton = (card: import("@playwright/test").Locator) => card.locator("button").nth(1)

test("a single paper downloads straight from paper storage", async ({ page, storage }) => {
  await openSubject(page)
  const card = paperCards(page).first()
  const fileName = await card.getAttribute("data-paper-file")

  const download = page.waitForEvent("download")
  await downloadButton(card).click()

  expect((await download).suggestedFilename()).toBe(fileName)
  expect(await readFile((await (await download).path())!)).toEqual(PDF_BYTES)
  expect(storage.requests.some((url) => url.endsWith(".pdf"))).toBe(true)
})

test("selected papers download as one ZIP with progress", async ({ page }) => {
  await openSubject(page)
  await page.getByRole("button", { name: "Enter selection mode" }).locator(visible).click()

  const names = await paperCards(page).evaluateAll((cards) =>
    cards.slice(0, 3).map((card) => card.getAttribute("data-paper-file")!),
  )
  for (const name of names) await page.locator(`[data-paper-file="${name}"]`).click()
  await expect(page.getByRole("button", { name: "Download 3 Papers" })).toBeVisible()

  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download 3 Papers" }).click()
  await expect(page.getByRole("progressbar", { name: "Batch download progress" })).toBeVisible()

  const zipFile = await download
  expect(zipFile.suggestedFilename()).toBe("Computer_Networks_Papers.zip")
  const zip = await JSZip.loadAsync(await readFile((await zipFile.path())!))
  expect(Object.keys(zip.files).sort()).toEqual(
    names.map((n) => (n.endsWith(".pdf") ? n : `${n}.pdf`)).sort(),
  )

  await expect(page.getByRole("heading", { name: "Download Complete" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Download 3 Papers" })).toHaveCount(0, {
    timeout: 5000,
  })
  await expect(
    page.getByRole("button", { name: "Enter selection mode" }).locator(visible),
  ).toBeVisible()
})

test("select all picks every visible paper", async ({ page }) => {
  await openSubject(page)
  await page.getByRole("button", { name: "Enter selection mode" }).locator(visible).click()
  await page.getByRole("button", { name: "Select All" }).click()
  await expect(page.getByRole("button", { name: "Download 60 Papers" })).toBeVisible()
  await page.getByRole("button", { name: "Deselect All" }).click()
  await expect(page.getByRole("button", { name: /Download \d+ Papers?/ })).toHaveCount(0)
})

test("preview opens the PDF viewer and steps through papers", async ({ page, storage }) => {
  await openSubject(page)
  const first = await paperCards(page).first().getAttribute("data-paper-file")
  const second = await paperCards(page).nth(1).getAttribute("data-paper-file")

  await previewButton(paperCards(page).first()).click()
  const dialog = page.getByRole("dialog", { name: `Preview of ${first}` })
  await expect(dialog).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await previewButton(paperCards(page).first()).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator("iframe")).toHaveAttribute(
    "src",
    /mozilla\.github\.io\/pdf\.js\/web\/viewer\.html\?file=/,
  )

  await dialog.getByRole("button", { name: "Next PDF" }).click()
  await expect(page.getByRole("dialog", { name: `Preview of ${second}` })).toBeVisible()
  await page.getByRole("button", { name: "Previous PDF" }).click()
  await expect(page.getByRole("dialog", { name: `Preview of ${first}` })).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(storage.requests.some((url) => url.startsWith("https://mozilla.github.io/pdf.js/"))).toBe(
    true,
  )
})

test("when paper storage is down, a banner explains and downloads are disabled", async ({
  page,
  storage,
}) => {
  storage.isUp = false
  await openSubject(page)

  await expect(page.getByText("Paper Storage Is Currently Unreachable")).toBeVisible()
  await expect(downloadButton(paperCards(page).first())).toBeDisabled()
  await expect(previewButton(paperCards(page).first())).toBeDisabled()

  const healthChecks = () => storage.requests.filter((url) => new URL(url).pathname === "/").length
  await expect.poll(healthChecks).toBeGreaterThanOrEqual(2)
  await expect(page.getByRole("button", { name: "Recheck server status" })).toBeEnabled()

  storage.isUp = true
  await page.getByRole("button", { name: "Recheck server status" }).click()
  await expect(page.getByText("Paper Storage Is Currently Unreachable")).toHaveCount(0)
  await expect(downloadButton(paperCards(page).first())).toBeEnabled()
})
