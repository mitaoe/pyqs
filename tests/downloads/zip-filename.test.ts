import { describe, expect, it } from "vitest"
import { formatZipFilename, zipEntryName } from "@/features/downloads/zip-filename"

const cn = { standardSubject: "Computer Networks", subject: "CN" }

describe("formatZipFilename", () => {
  it("names the archive after the subject and active filters", () => {
    expect(formatZipFilename([cn], {})).toBe("Computer_Networks_Papers.zip")
    expect(formatZipFilename([cn], { years: ["2024", "2023"], examTypes: ["MSE"] })).toBe(
      "Computer_Networks_Papers_2024-2023_MSE.zip",
    )
  })

  it("falls back when there is nothing to name it after", () => {
    expect(formatZipFilename([], {})).toBe("MITAoE_Papers.zip")
    expect(formatZipFilename([{ standardSubject: "", subject: "" }], {})).toBe("MITAoE_Papers.zip")
    expect(formatZipFilename([{ standardSubject: "", subject: "Raw  Name" }], {})).toBe(
      "Raw_Name_Papers.zip",
    )
  })
})

describe("zipEntryName", () => {
  it("ensures every entry ends in .pdf", () => {
    expect(zipEntryName("paper.pdf")).toBe("paper.pdf")
    expect(zipEntryName("paper.PDF")).toBe("paper.PDF")
    expect(zipEntryName("paper")).toBe("paper.pdf")
  })
})
