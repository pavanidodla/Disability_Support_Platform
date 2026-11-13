import mongoose from "mongoose";

// One document per user per taught sign. Each sample is one row of numbers (see the controller for sizes).
const customSignSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    samples: { type: [[Number]], default: [] },
  },
  { timestamps: true },
);

customSignSchema.index({ userId: 1, label: 1 }, { unique: true });

export default mongoose.model("CustomSign", customSignSchema);