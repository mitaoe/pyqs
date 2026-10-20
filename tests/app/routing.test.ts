import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config"

const ROOT = path.resolve(__dirname, "../..")
const ONE_DAY = 86400
const CATALOG_ROUTES = [
  "src/app/papers/page.tsx",
  "src/app/papers/[...subject]/page.tsx",
  "src/app/api/papers/route.ts",
]

describe("catalog routes", () => {
  it.each(CATALOG_ROUTES)("%s revalidates on the shared schedule", (file) => {
    const source = readFileSync(path.join(ROOT, file), "utf8")
    expect(source).toContain(`export const revalidate = ${ONE_DAY}`)
  })

  it("serves /papers?subject=… from the prerendered subject page", async () => {
    const rewrites = await nextConfig.rewrites!()
    expect(Array.isArray(rewrites)).toBe(false)
    const [rule] = (
      rewrites as {
        beforeFiles: {
          source: string
          destination: string
          has?: { type: string; key: string; value?: string }[]
        }[]
      }
    ).beforeFiles
    expect(rule).toMatchObject({ source: "/papers", destination: "/papers/:subject" })

    const matcher = new RegExp(`^${rule.has![0].value}$`)
    for (const subject of [
      "Computer Networks",
      "Introduction to Industrial IOT 4.0",
      ".NET",
      "..x",
      "...",
    ]) {
      expect(matcher.exec(subject)?.groups?.subject).toBe(subject)
    }
    for (const unsafe of ["100%", "a?b", "a#b", "", ".", "..", "a/b", "/x", "x/", "../../x"]) {
      expect(matcher.test(unsafe)).toBe(false)
    }
  })
})
