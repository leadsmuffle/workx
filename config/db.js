const mongoose = require('mongoose');

/**
 * Connects to MongoDB using Mongoose, caching the connection promise so
 * repeated invocations in a serverless environment (Vercel) reuse the same
 * connection instead of opening a new one per request/cold start. Call sites
 * should `await connectDB()` before touching the database.
 */
let cachedConnectionPromise = null;

const connectDB = () => {
  if (cachedConnectionPromise) return cachedConnectionPromise;

  cachedConnectionPromise = mongoose
    .connect(process.env.MONGO_URI)
    .then((conn) => {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((err) => {
      console.error(`MongoDB connection error: ${err.message}`);
      cachedConnectionPromise = null; // allow a retry on the next call instead of staying broken forever

      // In production (Vercel/serverless) a crashed process can't serve any other
      // request either, so we let the caller turn this into a clean 500 JSON
      // response instead. Locally/in a traditional host, fail fast like before
      // so a process manager (PM2, Docker, Render) restarts it.
      if (process.env.NODE_ENV === 'production') throw err;
      process.exit(1);
    });

  return cachedConnectionPromise;
};

module.exports = connectDB;
