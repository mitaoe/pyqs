import { defineConfig } from "@playwright/test"

// Drives the real app via the system Chrome (channel: "chrome") — no browser
// download needed. Reuses a running dev server if one is up.
export default defineConfig({
    testDir: "./e2e",
    timeout: 90_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    use: {
        baseURL: "http://localhost:3000",
        channel: "chrome",
        headless: true,
        launchOptions: { args: ["--no-sandbox"] },
        trace: "off",
    },
    webServer: {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
    },
})
