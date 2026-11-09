import SignSession from "../models/SignSession.js";
import ActivityHistory from "../models/ActivityHistory.js";

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
