import mongoose from "mongoose";

const activityHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  feature: {
    type: String,
    enum: ["object-detection", "read-aloud", "sign-language", "voice-command"],
    required: true,
  },
  action: { type: String, required: true },
  title: { type: String },
  summary: { type: String },
  count: { type: Number, default: 1 },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model("ActivityHistory", activityHistorySchema);