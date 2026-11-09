import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getProfile, updateProfile } from "../controllers/authController.js";

const router = Router();

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

export default router;
