import { Router } from "express";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const COMMANDS = [
  { pattern: /open\s*(object|detection)/i, intent: "NAVIGATE", target: "object-detection" },
  { pattern: /read\s*(this|aloud|document)?/i, intent: "NAVIGATE", target: "read-aloud" },
  { pattern: /sign\s*language/i, intent: "NAVIGATE", target: "sign-language" },
  { pattern: /voice\s*command/i, intent: "NAVIGATE", target: "voice-commands" },
  { pattern: /dashboard|home/i, intent: "NAVIGATE", target: "dashboard" },
  { pattern: /history/i, intent: "NAVIGATE", target: "history" },
  { pattern: /setting/i, intent: "NAVIGATE", target: "settings" },
  { pattern: /go\s*back/i, intent: "BACK", target: null },
  { pattern: /start\s*(camera|detection)/i, intent: "ACTION", target: "start-camera" },
  { pattern: /stop\s*(reading|camera|control)/i, intent: "ACTION", target: "stop" },
];

router.post("/parse", authenticate, (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "Command text is required" });

  for (const cmd of COMMANDS) {
    if (cmd.pattern.test(command)) {
      return res.json({ intent: cmd.intent, target: cmd.target, command });
    }
  }
  return res.json({ intent: "UNKNOWN", target: null, command });
});

export default router;