import PYQ from "@/models/Paper"
import { connectToMongo } from "@/lib/mongodb"
import type { Paper } from "@/types/paper"
import { selectSubjectPapers } from "../papers"
import type { CatalogSnapshot } from "../types"
import { CatalogUnavailableError, type CatalogSource } from "./source"

const NEWEST = { "stats.lastUpdated": -1 } as const

export function createMongoSource(uri: string): CatalogSource {
  const connect = () => connectToMongo(uri)

  return {
    async readSubjectNames() {
      await connect()
      const doc = await PYQ.findOne({}, { "meta.standardSubjects": 1 })
        .sort(NEWEST)
        .lean<{ meta?: { standardSubjects?: string[] } }>()
      if (!doc) throw missingCatalog()
      return doc.meta?.standardSubjects ?? []
    },

    async readSubjectPapers(subject) {
      await connect()
      const wanted = subject.toLowerCase()
      const [doc] = await PYQ.aggregate<{ papers: Paper[] }>([
        { $sort: NEWEST },
        { $limit: 1 },
        {
          $project: {
            _id: 0,
            papers: {
              $filter: {
                input: "$papers",
                as: "paper",
                cond: {
                  $or: [
                    { $eq: [{ $toLower: "$$paper.standardSubject" }, wanted] },
                    { $eq: [{ $toLower: "$$paper.subject" }, wanted] },
                  ],
                },
              },
            },
          },
        },
      ])
      if (!doc) throw missingCatalog()
      return selectSubjectPapers(doc.papers, subject)
    },

    async readSnapshot() {
      await connect()
      const doc = await PYQ.findOne({}, { _id: 0, __v: 0 }).sort(NEWEST).lean<CatalogSnapshot>()
      if (!doc) throw missingCatalog()
      return { papers: doc.papers, meta: doc.meta, stats: doc.stats }
    },
  }
}

function missingCatalog() {
  return new CatalogUnavailableError(
    "MongoDB has no catalog document. Run `pnpm pyq-gen` to generate one.",
  )
}
