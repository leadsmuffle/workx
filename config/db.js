const mongoose = require('mongoose');

/**
 * Connects to MongoDB using Mongoose.
 * Exits the process on failure so process managers (PM2, Docker, Render) can restart it.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
