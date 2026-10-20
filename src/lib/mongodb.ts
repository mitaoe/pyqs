import mongoose from "mongoose"

const globalForMongo = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>
}

export function connectToMongo(uri: string): Promise<typeof mongoose> {
  globalForMongo.mongooseConnection ??= mongoose
    .connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    })
    .catch((error) => {
      globalForMongo.mongooseConnection = undefined
      throw error
    })

  return globalForMongo.mongooseConnection
}
