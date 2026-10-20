import { describe, expect, it } from "vitest"
import { requestedSubject } from "@/features/subject-papers/requested-subject"

const query = (search: string) => new URLSearchParams(search)

describe("requestedSubject", () => {
  it("reads the subject from the public query URL", () => {
    expect(requestedSubject("/papers", query("subject=Not%20A%20Subject"))).toBe("Not A Subject")
  })

  it("uses the last subject value, as the rewrite does", () => {
    expect(requestedSubject("/papers", query("subject=Data%20Structures&subject=Junk"))).toBe(
      "Junk",
    )
  })

  it("reads and decodes the subject from the path", () => {
    expect(requestedSubject("/papers/Not%20A%20Subject", query(""))).toBe("Not A Subject")
    expect(requestedSubject("/papers/A%20B/C", query(""))).toBe("A B/C")
  })

  it("keeps a value that is not valid percent-encoding", () => {
    expect(requestedSubject("/papers/100%", query(""))).toBe("100%")
  })

  it("returns null when no subject was asked for", () => {
    expect(requestedSubject("/papers", query(""))).toBeNull()
    expect(requestedSubject("/papers", query("subject="))).toBeNull()
    expect(requestedSubject("/papers/", query(""))).toBeNull()
    expect(requestedSubject("/elsewhere", query("subject=X"))).toBeNull()
  })
})
