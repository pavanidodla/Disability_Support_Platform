import mongoose from "mongoose";

const signSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recognizedSentence: { type: String, default: "" },
  detectedSigns: [{ sign: String, confidence: Number }],
  duration: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("SignSession", signSessionSchema);
