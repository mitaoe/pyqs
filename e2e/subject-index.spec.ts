import { expect, paperCards, SUBJECT, SUBJECT_URL, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await page.goto("/papers")
  await expect(page.getByRole("button", { name: SUBJECT })).toBeVisible()
})

test("only letters with subjects are enabled", async ({ page }) => {
  const letter = (l: string) =>
    page.getByRole("button", { name: `Jump to subjects starting with letter ${l}` })

  for (const enabled of ["A", "C", "D", "E", "I"]) await expect(letter(enabled)).toBeEnabled()
  for (const disabled of ["B", "Z"]) await expect(letter(disabled)).toBeDisabled()

  await letter("I").click()
  await expect(
    page.getByRole("button", { name: "Introduction to Industrial IOT 4.0" }),
  ).toBeInViewport()
})

test("search suggests subjects and opens one with the keyboard", async ({ page }) => {
  const search = page.getByRole("textbox", { name: "Search for subjects" })
  await search.fill("struct")
  await expect(page.getByRole("listitem")).toHaveText(["Data Structures"])

  await search.press("ArrowDown")
  await search.press("Enter")
  await expect(page).toHaveURL("/papers?subject=Data%20Structures")
  await expect(paperCards(page).first()).toBeVisible()
})

test("clearing the search hides suggestions", async ({ page }) => {
  const search = page.getByRole("textbox", { name: "Search for subjects" })
  await search.fill("comp")
  await expect(page.getByRole("listitem").first()).toBeVisible()
  await page.getByRole("button", { name: "Clear search" }).click()
  await expect(search).toHaveValue("")
  await expect(page.getByRole("listitem")).toHaveCount(0)
})

test("hovering a subject prefetches its page", async ({ page, appRequests, isMobile }) => {
  test.skip(isMobile, "hover only exists with a pointer")

  await page.getByRole("button", { name: SUBJECT }).hover()
  await expect
    .poll(() => appRequests.some((url) => url.startsWith(`/papers/${encodeURIComponent(SUBJECT)}`)))
    .toBe(true)

  await page.getByRole("button", { name: SUBJECT }).click()
  await expect(page).toHaveURL(SUBJECT_URL)
})
