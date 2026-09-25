import { test, expect, type Page } from "@playwright/test"
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
test.beforeAll(() => fs.mkdirSync(SHOT_DIR, { recursive: true }))

const cite = (page: Page) =>
    page.locator('svg[data-citation-threads] path[data-thread-kind="cite"]')
const idle = (page: Page) =>
    page.locator('svg[data-citation-threads] path[data-thread-kind="idle"]')

const setTheme = (page: Page, theme: "light" | "dark") =>
    page.addInitScript((t) => {
        try {
            localStorage.setItem("theme", t)
        } catch {}
    }, theme)

async function load(page: Page) {
    await stubPapers(page)
    await stubCitedAnswer(page, PAPER_FILES.slice(0, 4))
    await page.goto(PAPERS_URL)
    await expect(page.locator("[data-paper-file]").first()).toBeVisible({ timeout: 30_000 })
}
const openPanel = (page: Page) => page.getByRole("button", { name: /Ask AI about/ }).click()
const input = (page: Page) => page.getByPlaceholder(/Ask about/)

test.describe("ambient threads + glass — desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test("idle → ask → active → new chat → idle; no overflow", async ({ page }) => {
        const errors = collectConsoleErrors(page)
        await load(page)

        // Open the panel WITHOUT asking → IDLE ambient state.
        await openPanel(page)
        await expect(input(page)).toBeVisible()
        await expect(idle(page).first()).toBeVisible()
        expect(await cite(page).count()).toBe(0)
        await expect(page.locator("[data-idle-anchor]")).toHaveCount(1)
        await page.screenshot({ path: path.join(SHOT_DIR, "ambient-idle-dark.png") })

        // Ask → ACTIVE citation threads; idle retracts.
        await input(page).fill("Which papers cover this best?")
        await input(page).press("Enter")
        await expect(cite(page).first()).toBeVisible()
        await expect(idle(page)).toHaveCount(0)
        await expect(page.locator("[data-idle-anchor]")).toHaveCount(0)
        await page.screenshot({ path: path.join(SHOT_DIR, "ambient-active-dark.png") })

        // New chat clears the answer → transition back to IDLE.
        await page.getByRole("button", { name: "New chat" }).click()
        await expect(idle(page).first()).toBeVisible()
        await expect(cite(page)).toHaveCount(0)
        await expect(page.locator("[data-idle-anchor]")).toHaveCount(1)

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth
        )
        expect(overflow, `horizontal overflow ${overflow}px`).toBeLessThanOrEqual(1)
        expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([])
    })

    test("light theme — panel glass + idle ambience legible", async ({ page }) => {
        await setTheme(page, "light")
        await load(page)
        await openPanel(page)
        await expect(input(page)).toBeVisible()
        await expect(idle(page).first()).toBeVisible()
        // panel surface uses the glass class
        await expect(page.locator("[data-askai-panel].askai-glass")).toHaveCount(1)
        await page.screenshot({ path: path.join(SHOT_DIR, "ambient-idle-light.png") })
        await input(page).fill("Which papers cover this best?")
        await input(page).press("Enter")
        await expect(cite(page).first()).toBeVisible()
        await page.screenshot({ path: path.join(SHOT_DIR, "ambient-active-light.png") })
    })

    test("prefers-reduced-motion — no pulse, instant swap", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" })
        await load(page)
        await openPanel(page)
        await expect(idle(page).first()).toBeVisible()
        // The pulse animation is disabled under reduced motion.
        const animName = await page
            .locator(".askai-idle-dot")
            .evaluate((el) => getComputedStyle(el).animationName)
        expect(animName, "pulse disabled").toBe("none")
        // Swap still works (idle → active) without motion.
        await input(page).fill("Which papers cover this best?")
        await input(page).press("Enter")
        await expect(cite(page).first()).toBeVisible()
        await expect(idle(page)).toHaveCount(0)
        await page.screenshot({ path: path.join(SHOT_DIR, "ambient-reduced-motion.png") })
    })

    test("no long rAF task while scrolling with the idle pulse running", async ({ page }) => {
        await load(page)
        await openPanel(page)
        await expect(idle(page).first()).toBeVisible()
        // Collect long tasks (>50ms) during a scroll burst.
        const maxLongTask = await page.evaluate(async () => {
            const durations: number[] = []
            const po = new PerformanceObserver((list) => {
                for (const e of list.getEntries()) durations.push(e.duration)
            })
            po.observe({ entryTypes: ["longtask"] })
            const scroller = document.getElementById("scrollable-content")!
            for (let i = 0; i < 40; i++) {
                scroller.scrollTop += 12
                await new Promise((r) => requestAnimationFrame(r))
            }
            await new Promise((r) => setTimeout(r, 200))
            po.disconnect()
            return durations.length ? Math.max(...durations) : 0
        })
        // The thread recompute must not create long tasks (241ms class violation).
        expect(maxLongTask, `max long task ${maxLongTask}ms`).toBeLessThan(150)
    })
})

test.describe("panel glass — mobile bottom sheet", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test("frosted sheet in dark + light, no threads", async ({ page }) => {
        await load(page)
        await openPanel(page)
        await input(page).fill("Which papers cover this best?")
        await input(page).press("Enter")
        await expect(page.locator("[data-sources-active]")).toBeVisible({ timeout: 15_000 })
        await expect(page.locator("[data-askai-panel].askai-glass")).toHaveCount(1)
        expect(await page.locator("svg[data-citation-threads]").count()).toBe(0)
        await page.screenshot({ path: path.join(SHOT_DIR, "glass-mobile-dark.png") })
    })
})
