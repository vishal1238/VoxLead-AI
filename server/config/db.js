const mongoose = require('mongoose');

/**
 * Connects the Express backend to MongoDB using Mongoose.
 * Reads MONGODB_URI from environment variables.
 */
async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voxlead_ai';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    return false;
  }
}

/**
 * Helper to check if MongoDB is currently connected.
 * readyState === 1 means connected.
 */
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  isDbConnected,
};
