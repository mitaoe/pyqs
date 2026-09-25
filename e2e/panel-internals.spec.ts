import { test, expect, type Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { PAPERS_URL, SUBJECT, stubPapers, collectConsoleErrors } from "./fixtures"

const SHOT_DIR = path.join("test-results", "responsive")
test.beforeAll(() => fs.mkdirSync(SHOT_DIR, { recursive: true }))

// A wide YEAR_TREND table (10 year columns) — the intent most likely to force
// horizontal scroll inside a 360px panel.
function stubTrend(page: Page) {
    const years = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"]
    const topic = (name: string, status: "rising" | "staple" | "fading") => ({
        topic: name,
        exam_count: 20,
        counts: years.map((_, i) => (i % 3) + 1),
        first_year: "2015",
        last_year: "2024",
        status,
    })
    return page.route("**/api/ask", (route) =>
        route.fulfill({
            json: {
                intent: "YEAR_TREND",
                answer: "Here is the year-wise trend for the most-asked topics.",
                trend: {
                    years,
                    topics: [
                        topic("Numerical Methods and Error Analysis", "rising"),
                        topic("Partial Differential Equations", "staple"),
                        topic("Laplace and Fourier Transforms", "fading"),
                    ],
                },
            },
        })
    )
}

async function openAndAsk(page: Page) {
    await page.getByRole("button", { name: /Ask AI about/ }).click()
    const input = page.getByPlaceholder(/Ask about/)
    await expect(input).toBeVisible()
    await input.fill("year-wise trends")
    await input.press("Enter")
}

test.describe("panel internals — narrow trend table", () => {
    test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })

    test("wide trend table scrolls itself, never the page (360px)", async ({ page }) => {
        const errors = collectConsoleErrors(page)
        await stubPapers(page)
        await stubTrend(page)
        await page.goto(PAPERS_URL)
        await expect(page.locator("[data-paper-file]").first()).toBeVisible({ timeout: 30_000 })

        await openAndAsk(page)
        await expect(page.getByTestId("year-trend-answer")).toBeVisible({ timeout: 10_000 })
        await page.waitForTimeout(300)
        await page.screenshot({ path: path.join(SHOT_DIR, "360-trend-table.png") })

        // The page must not scroll horizontally…
        const pageOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth
        )
        expect(pageOverflow, `page horizontal overflow ${pageOverflow}px`).toBeLessThanOrEqual(1)

        // …but the table's own container IS allowed to (its scroll, not the page's).
        const tableScrolls = await page
            .getByTestId("year-trend-answer")
            .locator("div.overflow-x-auto")
            .first()
            .evaluate((el) => el.scrollWidth > el.clientWidth)
        expect(tableScrolls, "trend table has its own horizontal scroll").toBe(true)

        // Subject header + input still present and usable.
        await expect(page.locator("[data-askai-panel]").getByText(SUBJECT, { exact: false }).first()).toBeVisible()
        await expect(page.getByPlaceholder(/Ask about/)).toBeVisible()

        expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([])
    })
})
