import { expect, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Open settings" }).click()
})

test("theme toggles between dark and light", async ({ page }) => {
  const html = page.locator("html")
  await expect(html).toHaveClass(/dark/)
  await page.getByRole("button", { name: "Theme" }).click()
  await expect(html).toHaveClass(/light/)
  await page.reload()
  await expect(html).toHaveClass(/light/)
})

test("the ghost cursor can be switched on and is remembered", async ({ page }) => {
  await page.getByRole("button", { name: "Cursor" }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cursor-style"))).toBe("ghost")
  await page.mouse.move(400, 400)
  await expect(page.locator(".pointer-events-none.fixed svg")).toBeVisible()
})

test("clear cache is disabled until a paper has been cached", async ({ page }) => {
  await expect(page.getByText("No cached papers")).toBeVisible()
  await expect(page.getByRole("button", { name: /Clear Cache/ })).toBeDisabled()
})
