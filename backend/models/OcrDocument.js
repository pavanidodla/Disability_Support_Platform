import mongoose from "mongoose";

const ocrDocumentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fileName: { type: String },
  extractedText: { type: String },
  source: { type: String, enum: ["upload", "camera"], default: "upload" },
  language: { type: String, default: "eng" },
}, { timestamps: true });

export default mongoose.model("OcrDocument", ocrDocumentSchema);
