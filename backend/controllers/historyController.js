import mongoose from "mongoose";
import ActivityHistory from "../models/ActivityHistory.js";
import DetectionSession from "../models/DetectionSession.js";
import OcrDocument from "../models/OcrDocument.js";
import SignSession from "../models/SignSession.js";

const FEATURE_TO_TYPE = {
  "object-detection": "detection",
  "read-aloud": "ocr",
  "sign-language": "sign_language",
  "voice-command": "voice_command",
};
const FEATURES = Object.keys(FEATURE_TO_TYPE);
const TYPE_TO_FEATURE = Object.fromEntries(Object.entries(FEATURE_TO_TYPE).map(([f, t]) => [t, f]));

// POST /api/history - the frontend records what the user did
export async function logActivity(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const { feature, action, title, summary, count, details } = req.body;
    if (!FEATURE_TO_TYPE[feature]) {
      return res.status(400).json({ error: "Invalid feature" });
    }
    const activity = await ActivityHistory.create({
      userId: req.user.userId,
      feature,
      action: action || "use",
      title: typeof title === "string" ? title.slice(0, 200) : undefined,
      summary: typeof summary === "string" ? summary.slice(0, 500) : undefined,
      count: Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), 10000) : 1,
      details,
    });
    res.status(201).json({ id: activity._id });
  } catch (error) {
    console.error("Log activity error:", error);
    res.status(500).json({ error: "Failed to record activity" });
  }
}

// GET /api/history?type=detection&limit=50
export async function getHistory(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const type = req.query.type || req.query.feature;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const filter = { userId: req.user.userId, feature: { $in: FEATURES } };
    if (type && type !== "all") filter.feature = TYPE_TO_FEATURE[type] || type;

    const activities = await ActivityHistory.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const history = activities.map((a) => ({
      _id: a._id,
      type: FEATURE_TO_TYPE[a.feature] || a.feature,
      title: a.title || a.action,
      summary: a.summary || "",
      timestamp: a.createdAt,
    }));
    res.json({ history, activities });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
}

// DELETE /api/history - clear the user's activity
export async function clearHistory(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    await ActivityHistory.deleteMany({ userId: req.user.userId });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear history" });
  }
}

// GET /api/history/stats
export async function getStats(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [rows, recent, legacyDetections, legacyOcr, legacySigns] = await Promise.all([
      ActivityHistory.aggregate([
        { $match: { userId: userObjectId, feature: { $in: FEATURES } } },
        {
          $group: {
            _id: "$feature",
            total: { $sum: { $ifNull: ["$count", 1] } }, // sum of counts (objects, signs...)
            sessions: { $sum: 1 }, // number of records
          },
        },
      ]),
      ActivityHistory.find({ userId, feature: { $in: FEATURES } }).sort({ createdAt: -1 }).limit(6).lean(),
      DetectionSession.countDocuments({ userId }),
      OcrDocument.countDocuments({ userId }),
      SignSession.countDocuments({ userId }),
    ]);

    const byFeature = Object.fromEntries(rows.map((r) => [r._id, r]));
    const total = (f) => byFeature[f]?.total ?? 0;
    const sessions = (f) => byFeature[f]?.sessions ?? 0;

    const stats = {
      objectsDetected: total("object-detection") + legacyDetections,
      documentsRead: sessions("read-aloud") + legacyOcr,
      signsTranslated: total("sign-language") + legacySigns,
      voiceCommands: sessions("voice-command"),
    };
    stats.totalSessions = rows.reduce((sum, r) => sum + r.sessions, 0) + legacyDetections + legacyOcr + legacySigns;

    const recentActivity = recent.map((a) => ({
      _id: a._id,
      type: FEATURE_TO_TYPE[a.feature] || a.feature,
      title: a.title || a.action,
      timestamp: a.createdAt,
    }));

    // Flat fields (used by the dashboard) plus `stats` for backwards compatibility
    res.json({ ...stats, recentActivity, stats });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}