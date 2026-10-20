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

test("sweeping the pointer across the list prefetches only where it stops", async ({
  page,
  appRequests,
  isMobile,
}) => {
  test.skip(isMobile, "hover only exists with a pointer")
  await page.setViewportSize({ width: 1280, height: 1600 })

  const subjects = [
    "Advanced Analysis",
    "Computer Networks",
    "Data Structures",
    "Engineering Chemistry",
    "Introduction to Industrial IOT 4.0",
  ]
  const centres = []
  for (const subject of subjects) {
    const button = page.getByRole("button", { name: subject })
    await expect(button).toBeInViewport()
    const box = (await button.boundingBox())!
    centres.push({ x: box.x + 10, y: box.y + box.height / 2 })
  }

  await page.evaluate(() => {
    const entered: { subject: string; at: number }[] = []
    Object.assign(window, { entered })
    document.addEventListener("pointerover", (event) => {
      const subject = (event.target as HTMLElement).closest("button")?.textContent
      if (subject && subject !== entered.at(-1)?.subject) {
        entered.push({ subject, at: performance.now() })
      }
    })
  })
  for (const { x, y } of centres) await page.mouse.move(x, y)
  await page.waitForTimeout(1000)

  const entered = await page.evaluate(
    () => (window as unknown as { entered: { subject: string; at: number }[] }).entered,
  )
  const restedOn = entered
    .filter(({ at }, i) => i === entered.length - 1 || entered[i + 1].at - at >= 80)
    .map(({ subject }) => subject)
  expect(restedOn).toContain("Introduction to Industrial IOT 4.0")

  const prefetched = new Set(
    appRequests
      .filter((url) => url.startsWith("/papers/"))
      .map((url) => decodeURIComponent(url.split("?")[0].slice("/papers/".length))),
  )
  expect([...prefetched].sort()).toEqual(restedOn.sort())
})
