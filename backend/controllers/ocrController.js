import OcrDocument from "../models/OcrDocument.js";
import ActivityHistory from "../models/ActivityHistory.js";

const PYTHON_URL = process.env.PYTHON_AI_SERVICE_URL || "http://localhost:8000";

export async function processOcr(req, res) {
  try {
    const { image, language = "eng" } = req.body;
    if (!image) return res.status(400).json({ error: "Image data is required" });

    const pyResponse = await fetch(`${PYTHON_URL}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, language }),
    });

    if (!pyResponse.ok) {
      return res.json({ text: "", message: "AI service unavailable" });
    }

    const result = await pyResponse.json();

    // Save document if user is authenticated
    if (req.user && result.text) {
      await OcrDocument.create({
        userId: req.user.userId,
        extractedText: result.text,
        source: "camera",
        language,
      });
      await ActivityHistory.create({
        userId: req.user.userId,
        feature: "read-aloud",
        action: "OCR processed",
        details: { textLength: result.text.length },
      });
    }

    res.json(result);
  } catch (error) {
    console.error("OCR error:", error);
    res.status(500).json({ error: "OCR processing failed" });
  }
}
