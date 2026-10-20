import {
  expect,
  openSubject,
  paperCards,
  SUBJECT,
  SUBJECT_PAPER_COUNT,
  SUBJECT_URL,
  test,
} from "./fixtures"

test("home opens the subject list without downloading the catalog", async ({
  page,
  appRequests,
}) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "PYQs" })).toBeVisible()

  await page.getByRole("link", { name: "Search Papers" }).click()
  await expect(page).toHaveURL("/papers")
  await expect(page.getByRole("heading", { name: "Find Your Papers" })).toBeVisible()
  await expect(page.getByRole("button", { name: SUBJECT })).toBeVisible()

  expect(appRequests.filter((url) => url.startsWith("/api/"))).toEqual([])
})

test("a shared subject link renders straight away", async ({ page }) => {
  await openSubject(page)
  await expect(page).toHaveURL(SUBJECT_URL)
  await expect(page).toHaveTitle(`${SUBJECT} Papers | MITAoE Previous Year Question Papers`)
  await expect(page.getByRole("heading", { name: SUBJECT, level: 2 })).toBeVisible()
  await expect(page.getByText(`${SUBJECT_PAPER_COUNT} papers`)).toBeVisible()
  await expect(paperCards(page)).toHaveCount(SUBJECT_PAPER_COUNT)
})

test("opening a subject from the list keeps the public URL and history", async ({ page }) => {
  await page.goto("/papers")
  await page.getByRole("button", { name: SUBJECT }).click()

  await expect(paperCards(page).first()).toBeVisible()
  await expect(page).toHaveURL(SUBJECT_URL)

  await page.getByRole("button", { name: "Back to Subjects" }).click()
  await expect(page).toHaveURL("/papers")
  await expect(page.getByRole("heading", { name: "Find Your Papers" })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(SUBJECT_URL)
  await expect(paperCards(page).first()).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(SUBJECT_URL)
  await expect(paperCards(page)).toHaveCount(SUBJECT_PAPER_COUNT)
})

test("subject links ignore case", async ({ page }) => {
  await openSubject(page, "/papers?subject=computer%20networks")
  await expect(paperCards(page)).toHaveCount(SUBJECT_PAPER_COUNT)
})

test("an unknown subject says so and returns to the list", async ({ page }) => {
  await page.goto("/papers?subject=Not%20A%20Subject")
  await expect(page.getByText('Subject "Not A Subject" not found')).toBeVisible()
  await expect(page.getByText("No papers found")).toBeVisible()
  await expect(page).toHaveURL("/papers", { timeout: 10_000 })
})

test("the 404 page links home", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-page")
  expect(response?.status()).toBe(404)
  await expect(page.getByText("This ghost took a wrong turn")).toBeVisible()
  await page.getByRole("link", { name: "Go Home" }).click()
  await expect(page).toHaveURL("/")
})

test("the old 2 MB catalog cache is cleared from returning browsers", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1")
      localStorage.setItem("pyq_papers_data_v2", "{}")
      localStorage.setItem("pyqs_redirect_after_load", "/papers")
    }
  })
  await page.goto("/")
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem("pyq_papers_data_v2"),
        localStorage.getItem("pyqs_redirect_after_load"),
      ]),
    )
    .toEqual([null, null])
})

test("switching between the list and a subject does not replay the page transition", async ({
  page,
}) => {
  await page.goto("/papers")
  await expect(page.getByRole("button", { name: SUBJECT })).toBeVisible()
  const transition = page.locator("#scrollable-content > div > div").first()
  await expect.poll(() => transition.evaluate((el) => getComputedStyle(el).opacity)).toBe("1")
  const lowest = async (samples: Promise<string[]>) => Math.min(...(await samples).map(Number))

  const sampleOpacity = () =>
    transition.evaluate(
      (el) =>
        new Promise<string[]>((resolve) => {
          const samples: string[] = []
          const timer = setInterval(() => {
            samples.push(getComputedStyle(el).opacity)
            if (samples.length === 20) {
              clearInterval(timer)
              resolve(samples)
            }
          }, 25)
        }),
    )

  const opening = sampleOpacity()
  await page.getByRole("button", { name: SUBJECT }).click()
  expect(await lowest(opening)).toBeGreaterThan(0.9)
  await expect(paperCards(page).first()).toBeVisible()

  const goingBack = sampleOpacity()
  await page.getByRole("button", { name: "Back to Subjects" }).click()
  expect(await lowest(goingBack)).toBeGreaterThan(0.9)
})

test("the not-found toast survives the redirect to the subject list", async ({ page }) => {
  await page.goto("/papers?subject=Not%20A%20Subject")
  const toast = page.getByText('Subject "Not A Subject" not found')
  await expect(toast).toBeVisible()
  const handle = await toast.elementHandle()

  await expect(page).toHaveURL("/papers", { timeout: 10_000 })
  expect(await handle!.evaluate((el) => el.isConnected)).toBe(true)
  await expect(toast).toBeVisible()
})

test("/browse asks for the directory once even when it fails", async ({ page, appRequests }) => {
  await page.goto("/browse")
  await page.waitForTimeout(3000)
  expect(appRequests.filter((url) => url.startsWith("/api/directory"))).toHaveLength(1)
})
