import { Router } from "express";
import { detect } from "../controllers/objectDetectionController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.post("/", authenticate, detect);

export default router;
