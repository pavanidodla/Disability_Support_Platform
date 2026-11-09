import { Router } from "express";
import { recognize, saveSession } from "../controllers/signLanguageController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.post("/recognize", authenticate, recognize);
router.post("/session", authenticate, saveSession);

export default router;
