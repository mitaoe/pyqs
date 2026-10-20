import { describe, expect, it } from "vitest"
import {
  EMPTY_FILTERS,
  filterPapers,
  hasActiveFilters,
  matchesSubject,
  normalizeExamType,
  selectSubjectPapers,
  toggleFilterValue,
  yearOptions,
} from "@/features/catalog/papers"

const paper = (fileName: string, year: string, examType = "ESE", extra = {}) => ({
  fileName,
  year,
  examType,
  url: `https://pdf.example/${fileName}`,
  subject: "RAW NAME",
  standardSubject: "Computer Networks",
  ...extra,
})

describe("matchesSubject", () => {
  it("matches the standard or the raw subject, ignoring case", () => {
    const p = { subject: "CN LAB", standardSubject: "Computer Networks" }
    expect(matchesSubject(p, "computer networks")).toBe(true)
    expect(matchesSubject(p, "COMPUTER NETWORKS")).toBe(true)
    expect(matchesSubject(p, "cn lab")).toBe(true)
    expect(matchesSubject(p, "Computer Network")).toBe(false)
  })

  it("selectSubjectPapers keeps catalog order", () => {
    const papers = [
      { subject: "x", standardSubject: "A", id: 1 },
      { subject: "x", standardSubject: "B", id: 2 },
      { subject: "a", standardSubject: "C", id: 3 },
    ]
    expect(selectSubjectPapers(papers, "a").map((p) => p.id)).toEqual([1, 3])
  })
})

describe("normalizeExamType", () => {
  it("treats everything except MSE as ESE", () => {
    expect(normalizeExamType("MSE")).toBe("MSE")
    expect(normalizeExamType("mse")).toBe("MSE")
    expect(normalizeExamType("ESE")).toBe("ESE")
    expect(normalizeExamType("CAT")).toBe("ESE")
    expect(normalizeExamType("Unknown")).toBe("ESE")
  })
})

describe("filterPapers", () => {
  it("sorts newest year first and puts non-numeric years last, keeping ties stable", () => {
    const result = filterPapers(
      [paper("a", "2019"), paper("b", "THIRD YEAR"), paper("c", "2024"), paper("d", "2019")],
      EMPTY_FILTERS,
    )
    expect(result.map((p) => p.fileName)).toEqual(["c", "a", "d", "b"])
  })

  it("drops duplicate file names, keeping the first position and the last copy", () => {
    const result = filterPapers(
      [
        paper("same.pdf", "2024", "ESE", { url: "first" }),
        paper("other.pdf", "2023"),
        paper("same.pdf", "2022", "MSE", { url: "last" }),
      ],
      EMPTY_FILTERS,
    )
    expect(result.map((p) => [p.fileName, p.url])).toEqual([
      ["same.pdf", "last"],
      ["other.pdf", "https://pdf.example/other.pdf"],
    ])
  })

  it("filters by any selected year and by normalised exam type", () => {
    const papers = [
      paper("ese", "2024", "ESE"),
      paper("cat", "2024", "CAT"),
      paper("mse", "2024", "MSE"),
      paper("old", "2018", "MSE"),
    ]
    expect(
      filterPapers(papers, { years: ["2024"], examTypes: ["ESE"] }).map((p) => p.fileName),
    ).toEqual(["ese", "cat"])
    expect(
      filterPapers(papers, { years: ["2024", "2018"], examTypes: ["MSE"] }).map((p) => p.fileName),
    ).toEqual(["mse", "old"])
  })
})

describe("yearOptions", () => {
  it("lists each year once, newest first", () => {
    expect(
      yearOptions([{ year: "2019" }, { year: "2024" }, { year: "2019" }, { year: "2021" }]),
    ).toEqual(["2024", "2021", "2019"])
  })
})

describe("filter state helpers", () => {
  it("toggles a value on and off", () => {
    const on = toggleFilterValue(EMPTY_FILTERS, "years", "2024")
    expect(on).toEqual({ years: ["2024"], examTypes: [] })
    expect(hasActiveFilters(on)).toBe(true)
    const off = toggleFilterValue(on, "years", "2024")
    expect(off).toEqual(EMPTY_FILTERS)
    expect(hasActiveFilters(off)).toBe(false)
  })
})
