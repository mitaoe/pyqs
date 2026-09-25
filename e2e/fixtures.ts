import type { Page } from "@playwright/test"

export const SUBJECT = "Advanced Analysis"
export const PAPERS_URL = `/papers?subject=${encodeURIComponent(SUBJECT)}`

// A deterministic set of papers for the subject, so the split view renders
// cards WITHOUT a live MongoDB (Atlas IP-whitelisting makes live data flaky in
// CI/sandboxes). Enough cards to exercise 4→3→2 grid columns.
const YEARS = ["2023", "2023", "2022", "2022", "2021", "2021", "2020", "2020", "2019", "2019", "2018", "2018"]
export const PAPER_FILES = YEARS.map(
    (y, i) => `BTech_ME_${SUBJECT}_SEM-VIII_${i % 2 ? "MAY" : "DEC"} ${y}.pdf`
)

function papersFixture() {
    const papers = PAPER_FILES.map((fileName, i) => ({
        year: YEARS[i],
        examType: i % 3 === 0 ? "MSE" : "ESE",
        branch: "ME",
        semester: "VIII",
        subject: SUBJECT,
        standardSubject: SUBJECT,
        fileName,
        url: `https://example.com/pdf/${encodeURIComponent(fileName)}`,
    }))
    return {
        meta: {
            papers,
            years: [...new Set(YEARS)],
            branches: ["ME"],
            examTypes: ["ESE", "MSE"],
            semesters: ["VIII"],
            subjects: [SUBJECT],
            standardSubjects: [SUBJECT],
        },
        lastUpdated: "2024-01-01T00:00:00.000Z",
        stats: {
            totalFiles: papers.length,
            totalDirectories: 0,
            lastUpdated: "2024-01-01T00:00:00.000Z",
        },
    }
}

/** Serve the papers fixture for /api/papers (any query string). */
export async function stubPapers(page: Page) {
    await page.route("**/api/papers**", (route) =>
        route.fulfill({ json: papersFixture() })
    )
}

/** Serve a deterministic SEMANTIC answer citing the given real card files. */
export async function stubCitedAnswer(page: Page, files: string[]) {
    await page.unroute("**/api/ask").catch(() => {})
    await page.route("**/api/ask", (route) =>
        route.fulfill({
            json: {
                intent: "SEMANTIC",
                answer: "These are the most relevant papers [1][2][3].",
                citations: files.map((f, i) => ({
                    ref: i + 1,
                    question_text: `Question ${i + 1}`,
                    marks: 5,
                    sub_label: null,
                    file_name: f,
                    year: "2023",
                    exam_type: "ESE",
                    url: `https://example.com/${i}.pdf`,
                    standard_subject: SUBJECT,
                    similarity: 0.9 - i * 0.05,
                })),
            },
        })
    )
}

export const IGNORED_ERRORS = [/Encountered a script tag/i]

export function collectConsoleErrors(page: Page): string[] {
    const errors: string[] = []
    page.on("console", (m) => {
        if (m.type() === "error" && !IGNORED_ERRORS.some((re) => re.test(m.text())))
            errors.push(m.text())
    })
    page.on("pageerror", (e) => errors.push(String(e)))
    return errors
}
