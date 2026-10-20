import { describe, expect, it } from "vitest"
import {
  decodeSubjectParam,
  getAvailableLetters,
  getHighlightedText,
  groupSubjectsByLetter,
  resolveSubject,
  searchSubjects,
  subjectHref,
  subjectPath,
} from "@/features/catalog/subjects"

const SUBJECTS = [
  "Computer Networks",
  "Advanced Computing",
  "Compiler Design",
  "Data Structures",
  "computer graphics",
  "Engineering Chemistry",
]

describe("searchSubjects", () => {
  it("ranks prefix matches first, then alphabetical", () => {
    expect(searchSubjects(SUBJECTS, "comp")).toEqual([
      "Compiler Design",
      "computer graphics",
      "Computer Networks",
      "Advanced Computing",
    ])
  })

  it("returns nothing for a blank query and honours the limit", () => {
    expect(searchSubjects(SUBJECTS, "   ")).toEqual([])
    expect(searchSubjects(SUBJECTS, "e", 2)).toHaveLength(2)
  })
})

describe("alphabet grouping", () => {
  it("groups by upper-cased first letter, sorted and unique", () => {
    const grouped = groupSubjectsByLetter([...SUBJECTS, "Data Structures"])
    expect(grouped.C).toEqual(["Compiler Design", "Computer Networks", "computer graphics"])
    expect(grouped.D).toEqual(["Data Structures"])
    expect(getAvailableLetters(SUBJECTS)).toEqual(new Set(["C", "A", "D", "E"]))
  })
})

describe("getHighlightedText", () => {
  it("splits around the first case-insensitive match", () => {
    expect(getHighlightedText("Computer Networks", "NET")).toEqual({
      prefix: "Computer ",
      highlight: "Net",
      suffix: "works",
    })
    expect(getHighlightedText("Physics", "xyz")).toEqual({
      prefix: "Physics",
      highlight: "",
      suffix: "",
    })
  })
})

describe("subject URLs", () => {
  it("keeps the public query-string URL", () => {
    expect(subjectHref("Introduction to Industrial IOT 4.0")).toBe(
      "/papers?subject=Introduction%20to%20Industrial%20IOT%204.0",
    )
  })

  it("builds the prerendered path, keeping slashes as segments", () => {
    expect(subjectPath("Computer Networks")).toBe("/papers/Computer%20Networks")
    expect(subjectPath("Signals & Systems/Lab")).toBe("/papers/Signals%20%26%20Systems/Lab")
  })

  it("decodes route params without throwing on stray percent signs", () => {
    expect(decodeSubjectParam("Computer%20Networks")).toBe("Computer Networks")
    expect(decodeSubjectParam("100%")).toBe("100%")
  })

  it("resolves the catalog spelling ignoring case", () => {
    expect(resolveSubject(SUBJECTS, "COMPUTER networks")).toBe("Computer Networks")
    expect(resolveSubject(SUBJECTS, "Networks")).toBeNull()
  })
})
