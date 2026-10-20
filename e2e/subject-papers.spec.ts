import { expect, openSubject, paperCards, SUBJECT_PAPER_COUNT, test } from "./fixtures"

const filterButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Show filters" }).locator("visible=true")

test.beforeEach(async ({ page }) => {
  await openSubject(page)
})

test("papers are listed newest first", async ({ page }) => {
  const years = await paperCards(page).locator("span").first().allTextContents()
  expect(years[0]).toBe("2024")
})

test("year and exam type filters narrow the list and can be cleared", async ({ page }) => {
  await filterButton(page).click()
  const dropdown = page
    .getByRole("heading", { name: "Filters" })
    .locator("visible=true")
    .locator("../..")

  await dropdown.getByRole("button", { name: "2023", exact: true }).click()
  await expect(page.getByText("11 papers")).toBeVisible()

  await dropdown.getByRole("button", { name: "MSE", exact: true }).click()
  await expect(page.getByText("2 papers")).toBeVisible()
  await expect(paperCards(page)).toHaveCount(2)

  await dropdown.getByRole("button", { name: "Clear All Filters" }).click()
  await expect(page.getByText(`${SUBJECT_PAPER_COUNT} papers`)).toBeVisible()
})

test("an impossible filter combination shows the empty state", async ({ page }) => {
  await page.goto("/papers?subject=Introduction%20to%20Industrial%20IOT%204.0")
  await expect(paperCards(page)).toHaveCount(1)

  await filterButton(page).click()
  await page.getByRole("button", { name: "ESE", exact: true }).locator("visible=true").click()
  await expect(page.getByText("No papers match the current filters.")).toBeVisible()
  await expect(page.getByText("0 papers")).toBeVisible()
})

test("view mode switches between grid and list", async ({ page, isMobile }) => {
  test.skip(isMobile, "the desktop toggle is hidden on phones")

  const grid = page.locator("[data-papers-list].grid")
  await expect(grid).toBeVisible()
  await page.getByRole("button", { name: "List view" }).click()
  await expect(grid).toHaveCount(0)
  await expect(page.locator("[data-papers-list]")).toBeVisible()
  await page.getByRole("button", { name: "Grid view" }).click()
  await expect(grid).toBeVisible()
})

test("phones get the list view", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only")
  await expect(page.locator("[data-papers-list].grid")).toHaveCount(0)
})

test("the select-mode tip shows once", async ({ page }) => {
  await page.evaluate(() => {
    sessionStorage.setItem("keep-tutorial", "1")
    localStorage.removeItem("papers_select_tutorial_seen")
  })
  await page.reload()

  const gotIt = page.getByRole("button", { name: "Got it!" }).locator("visible=true")
  await expect(gotIt).toBeVisible()
  await gotIt.click()
  await expect(gotIt).toHaveCount(0)

  await page.reload()
  await expect(paperCards(page).first()).toBeVisible()
  await page.waitForTimeout(2000)
  await expect(gotIt).toHaveCount(0)
})
