import { test, expect, type Page } from "@playwright/test"
import {
    SUBJECT,
    PAPERS_URL,
    PAPER_FILES,
    stubPapers,
    stubCitedAnswer,
    collectConsoleErrors,
} from "./fixtures"

async function loadPapers(page: Page) {
    await stubPapers(page)
    await stubCitedAnswer(page, PAPER_FILES.slice(0, 4))
    await page.goto(PAPERS_URL)
    await expect(page.locator("[data-paper-file]").first()).toBeVisible({
        timeout: 30_000,
    })
}

async function openPanelAndAsk(page: Page) {
    await page.getByRole("button", { name: /Ask AI about/ }).click()
    const input = page.getByPlaceholder(/Ask about/)
    await expect(input).toBeVisible()
    await input.fill("Which papers cover this best?")
    await input.press("Enter")
}

const citeThreads = (page: Page) =>
    page.locator('svg[data-citation-threads] path[data-thread-kind="cite"]')
const idleThreads = (page: Page) =>
    page.locator('svg[data-citation-threads] path[data-thread-kind="idle"]')

test.describe("citation threads — desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test("draw, survive scroll/resize/view-toggle/filter, clear on close & new question", async ({
        page,
    }) => {
        const errors = collectConsoleErrors(page)
        await loadPapers(page)
        await openPanelAndAsk(page)

        // Hardened: the panel must show real CONTENT, not just a container —
        // the subject header + the input (guards the empty-right-pane bug).
        const panel = page.locator("[data-askai-panel]")
        await expect(panel.getByText(SUBJECT, { exact: false }).first()).toBeVisible()
        await expect(page.getByPlaceholder(/Ask about/)).toBeVisible()
        const box = await panel.boundingBox()
        expect(box!.height, "panel on-screen height").toBeGreaterThan(600)
        expect(box!.y, "panel top at 0").toBeLessThanOrEqual(1)

        // 1) CITATION threads draw to the cited cards; idle threads retract
        //    (they fade out via AnimatePresence, so wait for them to reach 0).
        await expect(citeThreads(page).first()).toBeVisible()
        expect(await citeThreads(page).count()).toBeGreaterThan(0)
        await expect(idleThreads(page)).toHaveCount(0)

        // 2) Scroll the list — threads persist.
        await page.locator("#scrollable-content").evaluate((el) => (el.scrollTop += 180))
        await page.waitForTimeout(250)
        expect(await citeThreads(page).count()).toBeGreaterThan(0)

        // 3) Resize — threads persist.
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.waitForTimeout(250)
        expect(await citeThreads(page).count()).toBeGreaterThan(0)

        // 4) Toggle grid → list — threads recompute.
        await page.getByRole("button", { name: "List view" }).click()
        await page.waitForTimeout(400)
        expect(await citeThreads(page).count()).toBeGreaterThan(0)

        // 5) Filter (best-effort) — recompute without error. (No Escape — the
        //    panel treats Escape as close.)
        const filterBtn = page.locator('button[aria-label="Show filters"]:visible').first()
        if (await filterBtn.count()) {
            await filterBtn.click()
            await page.waitForTimeout(400)
            expect(await citeThreads(page).count()).toBeGreaterThanOrEqual(0)
            await filterBtn.click()
            await page.waitForTimeout(200)
        }

        // 6) Close (Escape) — ALL threads (both kinds) clear.
        await page.keyboard.press("Escape")
        await expect(page.locator("svg[data-citation-threads] path")).toHaveCount(0)
        await expect(page.locator("[data-idle-anchor]")).toHaveCount(0)

        // 7) Reopen — the answer is still on screen → citation threads re-draw.
        await page.getByRole("button", { name: /Ask AI about/ }).click()
        await page.waitForTimeout(500)
        expect(await citeThreads(page).count()).toBeGreaterThan(0)

        // 8) New question with no citations → citation threads clear and the
        //    overlay transitions back to IDLE ambient threads + the anchor dot.
        await page.route("**/api/ask", (route) =>
            route.fulfill({
                json: { intent: "ANALYTICS", answer: "No sources here.", clusters: [] },
            })
        )
        const input = page.getByPlaceholder(/Ask about/)
        await input.fill("most repeated questions")
        await input.press("Enter")
        await expect(citeThreads(page)).toHaveCount(0)
        await expect(idleThreads(page).first()).toBeVisible()
        await expect(page.locator("[data-idle-anchor]")).toHaveCount(1)

        expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([])
    })
})

test.describe("citation threads — mobile 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test("bottom sheet renders the answer but draws NO threads", async ({ page }) => {
        const errors = collectConsoleErrors(page)
        await loadPapers(page)
        await openPanelAndAsk(page)

        await expect(page.locator("[data-sources-active]")).toBeVisible({ timeout: 15_000 })
        await page.waitForTimeout(400)
        expect(await page.locator("svg[data-citation-threads]").count()).toBe(0)

        expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([])
    })
})
