import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

let cached: MongooseCache = {
  conn: null,
  promise: null
};

async function dbConnect() {
  if (cached.conn) {
    console.log('Using cached database connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      retryReads: true
    };

    const [host] = MONGODB_URI.split('@').slice(-1);
    console.log('Connecting to MongoDB...', host);

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('Connected to MongoDB successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB connection error:', e);
    throw e;
  }

  return cached.conn;
}

// Add disconnect function for cleanup
async function dbDisconnect() {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached = {
      conn: null,
      promise: null
    };
    console.log('Disconnected from MongoDB');
  }
}

export { dbConnect as default, dbDisconnect }; 