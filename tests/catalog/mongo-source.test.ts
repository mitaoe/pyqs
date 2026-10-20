import path from "node:path"
import mongoose from "mongoose"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createFileSource } from "@/features/catalog/server/file-source"
import { createMongoSource } from "@/features/catalog/server/mongo-source"
import fixture from "../fixtures/catalog.json"

const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI

describe.skipIf(!MONGODB_TEST_URI)("MongoDB catalog source", () => {
  const files = createFileSource(path.resolve(__dirname, "../fixtures/catalog.json"))
  let mongo: ReturnType<typeof createMongoSource>

  beforeAll(async () => {
    const { papers, ...meta } = fixture.meta
    const older = {
      papers: [],
      meta: { ...meta, standardSubjects: ["Stale"] },
      stats: { ...fixture.stats, lastUpdated: new Date("2020-01-01") },
    }
    const newest = {
      papers,
      meta,
      stats: { ...fixture.stats, lastUpdated: new Date(fixture.stats.lastUpdated) },
    }

    const seed = await mongoose.createConnection(MONGODB_TEST_URI!).asPromise()
    await seed.collection("pyqs").deleteMany({})
    await seed.collection("pyqs").insertMany([older, newest])
    await seed.close()

    mongo = createMongoSource(MONGODB_TEST_URI!)
  })

  afterAll(() => mongoose.disconnect())

  it("reads the newest document's subject list", async () => {
    expect(await mongo.readSubjectNames()).toEqual(await files.readSubjectNames())
  })

  it("returns exactly what the file source returns for every subject and case variant", async () => {
    for (const subject of fixture.meta.standardSubjects) {
      for (const variant of [subject, subject.toUpperCase(), subject.toLowerCase()]) {
        expect(await mongo.readSubjectPapers(variant)).toEqual(
          await files.readSubjectPapers(variant),
        )
      }
    }
    expect(await mongo.readSubjectPapers("Not A Subject")).toEqual([])
  })

  it("treats operator-like input as plain text", async () => {
    for (const hostile of ["$$ROOT", "$$paper.subject", "$subject", "$$CURRENT", "{ $ne: 1 }"]) {
      expect(await mongo.readSubjectPapers(hostile)).toEqual(await files.readSubjectPapers(hostile))
    }
  })

  it("returns the full snapshot without Mongo internals", async () => {
    const snapshot = await mongo.readSnapshot()
    expect(snapshot.papers).toEqual(fixture.meta.papers)
    expect(snapshot).not.toHaveProperty("_id")
    expect(new Date(snapshot.stats.lastUpdated).toISOString()).toBe(fixture.stats.lastUpdated)
  })
})
