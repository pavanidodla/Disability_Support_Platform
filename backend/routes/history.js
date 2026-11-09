import { Router } from "express";
import { getHistory, getStats, logActivity, clearHistory } from "../controllers/historyController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.get("/", authenticate, getHistory);
router.post("/", authenticate, logActivity);
router.delete("/", authenticate, clearHistory);
router.get("/stats", authenticate, getStats);

export default router;