import dns from "dns";
import mongoose from "mongoose";

// Some networks/ISPs block or time out SRV lookups; use public DNS for MongoDB Atlas
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/accessai",
      { serverSelectionTimeoutMS: 15000 },
    );
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connectDB;