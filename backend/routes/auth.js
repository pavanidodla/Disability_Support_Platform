import { Router } from "express";
import { register, login, googleAuth, getProfile, updateProfile } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

export default router;