import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import {
    SUBJECT,
    PAPERS_URL,
    PAPER_FILES,
    stubPapers,
    stubCitedAnswer,
    collectConsoleErrors,
} from "./fixtures"

const SHOT_DIR = path.join("test-results", "responsive")

// The responsive model (see AskAiPanel / ClientProvider comments):
//   <1024  : no split; full-width host grid; pill → full-height bottom sheet; no threads
//   1024-1279 : split allowed but constrained (panel ≥360, list ≥~560, else auto-collapse to pill)
//   ≥1280  : full split; panel ~40% resizable 35-45%; list gets the rest
//   ≥1920  : panel caps at ~640px so wide answers stay readable
const MATRIX = [
    { name: "360x740-phone", width: 360, height: 740, split: false },
    { name: "390x844-phone", width: 390, height: 844, split: false },
    { name: "768x1024-tablet", width: 768, height: 1024, split: false },
    { name: "834x1112-tablet-landscape", width: 834, height: 1112, split: false },
    { name: "1024x768-small-laptop", width: 1024, height: 768, split: true },
    { name: "1280x800-laptop", width: 1280, height: 800, split: true },
    { name: "1440x900-desktop", width: 1440, height: 900, split: true },
    { name: "1920x1080-large", width: 1920, height: 1080, split: true },
]

test.beforeAll(() => fs.mkdirSync(SHOT_DIR, { recursive: true }))

for (const vp of MATRIX) {
    test(`responsive ${vp.name}`, async ({ page }) => {
        const errors = collectConsoleErrors(page)
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await stubPapers(page)
        await stubCitedAnswer(page, PAPER_FILES.slice(0, 4))

        await page.goto(PAPERS_URL)
        await expect(page.locator("[data-paper-file]").first()).toBeVisible({
            timeout: 30_000,
        })

        // Open the panel and ask.
        await page.getByRole("button", { name: /Ask AI about/ }).click()
        const input = page.getByPlaceholder(/Ask about/)
        await expect(input).toBeVisible({ timeout: 10_000 })
        await input.fill("Which papers cover this best?")
        await input.press("Enter")
        await expect(page.locator("[data-sources-active]")).toBeVisible({
            timeout: 10_000,
        })
        await page.waitForTimeout(400)

        await page.screenshot({ path: path.join(SHOT_DIR, `${vp.name}.png`) })

        // ── invariant: no page-level horizontal scrollbar ──
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth
        )
        expect(overflow, `horizontal overflow ${overflow}px`).toBeLessThanOrEqual(1)

        // ── visible panel CONTENT when open (not just the container) ──
        const panel = page.locator("[data-askai-panel]")
        await expect(panel.getByText(SUBJECT, { exact: false }).first()).toBeVisible()
        expect(await input.isVisible(), "panel input visible").toBe(true)
        const panelBox = await panel.boundingBox()
        expect(panelBox, "panel has a box").not.toBeNull()

        if (vp.split) {
            // Desktop: docked to the right edge with real, on-screen height.
            expect(panelBox!.width, "panel width").toBeGreaterThan(320)
            expect(panelBox!.height, "panel on-screen height").toBeGreaterThan(vp.height * 0.8)
            expect(
                Math.abs(panelBox!.x + panelBox!.width - vp.width),
                "panel right-docked"
            ).toBeLessThanOrEqual(2)
            expect(panelBox!.y, "panel top at 0").toBeLessThanOrEqual(1)
            // list keeps a usable width beside the panel
            expect(vp.width - panelBox!.width, "list width beside panel").toBeGreaterThanOrEqual(360)
            // ≥1920: panel capped so wide answers stay readable
            if (vp.width >= 1920)
                expect(panelBox!.width, "panel capped at large width").toBeLessThanOrEqual(660)
            // threads present in split mode
            expect(await page.locator("svg[data-citation-threads] path").count()).toBeGreaterThan(0)
        } else {
            // Mobile/tablet: bottom sheet spanning full width, no threads.
            expect(Math.round(panelBox!.width), "sheet full width").toBe(vp.width)
            expect(await page.locator("svg[data-citation-threads]").count(), "no threads").toBe(0)
        }

        // ── grid columns sane for the container (cards not crushed) ──
        const cardW = await page
            .locator("[data-paper-file]")
            .first()
            .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width)
        expect(cardW, "card min width").toBeGreaterThanOrEqual(220)

        expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([])
    })
}
