import SignSession from "../models/SignSession.js";
import ActivityHistory from "../models/ActivityHistory.js";
import CustomSign from "../models/CustomSign.js";

const PYTHON_URL = process.env.PYTHON_AI_SERVICE_URL || "http://localhost:8000";

export async function recognize(req, res) {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "Image data is required" });

    const pyResponse = await fetch(`${PYTHON_URL}/sign-language`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });

    if (!pyResponse.ok) {
      return res.json({ sign: null, confidence: 0, message: "AI service unavailable" });
    }

    const result = await pyResponse.json();
    res.json(result);
  } catch (error) {
    console.error("Sign language error:", error);
    res.status(500).json({ error: "Sign recognition failed" });
  }
}

export async function saveSession(req, res) {
  try {
    const { recognizedSentence, detectedSigns, duration } = req.body;
    if (!req.user) return res.status(401).json({ error: "Authentication required" });

    const session = await SignSession.create({
      userId: req.user.userId,
      recognizedSentence,
      detectedSigns,
      duration,
    });

    await ActivityHistory.create({
      userId: req.user.userId,
      feature: "sign-language",
      action: "Sign session saved",
      details: { signsCount: detectedSigns?.length || 0, sessionId: session._id },
    });

    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: "Failed to save session" });
  }
}

// ---- Taught signs ----
const MAX_LABEL = 40;
const STILL_DIM = 63; // one frame: 21 hand landmarks x 3
const TWO_HAND_DIM = 128; // one frame: two hands + the offset between them
const MOTION_DIM = 1408; // one clip: 16 frames x 88 (two hands + movement)
const BODY_DIM = 1696; // one clip: 16 frames x 106 (two hands + head + body + movement)
const MAX_STILL_SAMPLES = 400;
const MAX_MOTION_SAMPLES = 120;

const cleanLabel = (v) => String(v || "").trim().slice(0, MAX_LABEL);

export async function listCustomSigns(req, res) {
  try {
    const docs = await CustomSign.find({ userId: req.user.userId }).lean();
    const signs = {};
    docs.forEach((d) => {
      signs[d.label] = d.samples;
    });
    res.json({ signs });
  } catch (error) {
    console.error("List custom signs error:", error);
    res.status(500).json({ error: "Failed to load signs" });
  }
}

// Returns an error message, or null when the samples are valid
function validateSamples(samples) {
  const dim = Array.isArray(samples) && Array.isArray(samples[0]) ? samples[0].length : 0;
  if (dim !== STILL_DIM && dim !== TWO_HAND_DIM && dim !== MOTION_DIM && dim !== BODY_DIM) {
    return "Unknown sample format";
  }
  const max = dim === MOTION_DIM || dim === BODY_DIM ? MAX_MOTION_SAMPLES : MAX_STILL_SAMPLES;
  if (samples.length === 0 || samples.length > max) return `Too many samples (maximum ${max})`;
  for (const s of samples) {
    if (!Array.isArray(s) || s.length !== dim) return "Samples have different lengths";
    for (const v of s) if (!Number.isFinite(v)) return "Samples contain invalid numbers";
  }
  return null;
}

export async function saveCustomSign(req, res) {
  try {
    const label = cleanLabel(req.params.label);
    const { samples } = req.body;
    if (!label) return res.status(400).json({ error: "Sign name is required" });
    const problem = validateSamples(samples);
    if (problem) return res.status(400).json({ error: problem });

    const doc = await CustomSign.findOneAndUpdate(
      { userId: req.user.userId, label },
      { samples },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ label: doc.label, count: doc.samples.length });
  } catch (error) {
    console.error("Save custom sign error:", error);
    res.status(500).json({ error: "Failed to save sign" });
  }
}

// Save many signs in one request: { signs: { label: samples[] } }
// Replies { saved: [labels], failed: [{ label, error }] }
export async function saveCustomSignsBatch(req, res) {
  try {
    const { signs } = req.body;
    if (!signs || typeof signs !== "object") return res.status(400).json({ error: "Signs are required" });

    const ops = [];
    const saved = [];
    const failed = [];
    for (const [rawLabel, samples] of Object.entries(signs)) {
      const label = cleanLabel(rawLabel);
      const problem = !label ? "Sign name is required" : validateSamples(samples);
      if (problem) {
        failed.push({ label: rawLabel, error: problem });
        continue;
      }
      ops.push({
        updateOne: {
          filter: { userId: req.user.userId, label },
          update: { $set: { samples } },
          upsert: true,
        },
      });
      saved.push(label);
    }
    if (ops.length) await CustomSign.bulkWrite(ops, { ordered: false });
    res.json({ saved, failed });
  } catch (error) {
    console.error("Batch save custom signs error:", error);
    res.status(500).json({ error: "Failed to save signs" });
  }
}

export async function deleteCustomSign(req, res) {
  try {
    const label = cleanLabel(req.params.label);
    await CustomSign.deleteOne({ userId: req.user.userId, label });
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete custom sign error:", error);
    res.status(500).json({ error: "Failed to delete sign" });
  }
}