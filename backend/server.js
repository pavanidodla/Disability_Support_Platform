import "./loadEnv.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import connectDB from "./services/database.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import objectDetectionRoutes from "./routes/objectDetection.js";
import ocrRoutes from "./routes/ocr.js";
import signLanguageRoutes from "./routes/signLanguage.js";
import voiceCommandRoutes from "./routes/voiceCommand.js";
import historyRoutes from "./routes/history.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/object-detection", objectDetectionRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/sign-language", signLanguageRoutes);
app.use("/api/voice-command", voiceCommandRoutes);
app.use("/api/history", historyRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "AccessAI Backend", timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`AccessAI Backend running on port ${PORT}`);
});