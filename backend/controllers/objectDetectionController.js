import DetectionSession from "../models/DetectionSession.js";
import ActivityHistory from "../models/ActivityHistory.js";

const PYTHON_URL = process.env.PYTHON_AI_SERVICE_URL || "http://localhost:5001";

export async function detect(req, res) {
  try {
    const { image, voiceEnabled = true } = req.body;
    if (!image) return res.status(400).json({ error: "Image data is required" });

    // Forward to Python AI service (JSON base64 endpoint)
    const pyResponse = await fetch(`${PYTHON_URL}/detect-base64`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });

    if (!pyResponse.ok) {
      // Fallback: return empty detection if AI service unavailable
      return res.json({ detections: [], message: "AI service unavailable" });
    }

    const result = await pyResponse.json();

    // Save session if user is authenticated
    if (req.user) {
      const session = await DetectionSession.create({
        userId: req.user.userId,
        objectsDetected: result.detections || [],
        totalObjects: (result.detections || []).length,
        voiceEnabled,
      });
      await ActivityHistory.create({
        userId: req.user.userId,
        feature: "object-detection",
        action: "Detection session",
        details: { totalObjects: result.detections?.length || 0, sessionId: session._id },
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Detection error:", error);
    res.status(500).json({ error: "Detection failed" });
  }
}