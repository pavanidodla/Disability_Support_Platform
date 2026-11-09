import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  googleId: { type: String, unique: true, sparse: true },
  authProvider: { type: String, enum: ["local", "google"], default: "local" },
  avatar: { type: String },
  accessibilityPreferences: {
    visual: { type: Boolean, default: false },
    hearing: { type: Boolean, default: false },
    mobility: { type: Boolean, default: false },
    handsFree: { type: Boolean, default: false },
    general: { type: Boolean, default: false },
  },
  onboardingCompleted: { type: Boolean, default: false },
  settings: {
    highContrast: { type: Boolean, default: false },
    largeText: { type: Boolean, default: false },
    reducedAnimation: { type: Boolean, default: false },
    speechRate: { type: Number, default: 1.0 },
    speechVolume: { type: Number, default: 1.0 },
    detectionConfidence: { type: Number, default: 0.5 },
  },
}, { timestamps: true });

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export default mongoose.model("User", userSchema);