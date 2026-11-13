import { Router } from "express";
import {
  recognize,
  saveSession,
  listCustomSigns,
  saveCustomSign,
  saveCustomSignsBatch,
  deleteCustomSign,
} from "../controllers/signLanguageController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.post("/recognize", authenticate, recognize);
router.post("/session", authenticate, saveSession);

// Taught signs (kept permanently per user)
router.get("/custom-signs", authenticate, listCustomSigns);
router.post("/custom-signs/batch", authenticate, saveCustomSignsBatch);
router.put("/custom-signs/:label", authenticate, saveCustomSign);
router.delete("/custom-signs/:label", authenticate, deleteCustomSign);

export default router;