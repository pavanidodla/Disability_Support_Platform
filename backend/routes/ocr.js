import { Router } from "express";
import { processOcr } from "../controllers/ocrController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.post("/", authenticate, processOcr);

export default router;
