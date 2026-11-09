import mongoose from "mongoose";

const detectionSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  objectsDetected: [{ label: String, confidence: Number, x: Number, y: Number, width: Number, height: Number }],
  totalObjects: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  voiceEnabled: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("DetectionSession", detectionSessionSchema);
