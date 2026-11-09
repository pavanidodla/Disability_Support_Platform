import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { generateToken } from "../middleware/auth.js";

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash });
    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, settings: user.settings },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!user.passwordHash) {
      return res.status(401).json({ error: "This account uses Google sign-in. Please continue with Google." });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, settings: user.settings },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
}

export async function googleAuth(req, res) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "Google sign-in is not configured on the server" });
    }
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Google credential is required" });
    }

    let payload;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: "Invalid Google credential" });
    }
    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: "Your Google email address is not verified" });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
    if (!user) {
      user = await User.create({
        name: payload.name || email.split("@")[0],
        email,
        googleId: payload.sub,
        authProvider: "google",
        avatar: payload.picture,
      });
    } else {
      // Existing email/password account: link it, since Google verified this email
      let changed = false;
      if (!user.googleId) {
        user.googleId = payload.sub;
        changed = true;
      }
      if (!user.avatar && payload.picture) {
        user.avatar = payload.picture;
        changed = true;
      }
      if (changed) await user.save();
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, settings: user.settings },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Google sign-in failed", detail: error.message });
  }
}

export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash -googleId");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateProfile(req, res) {
  try {
    const { name, accessibilityPreferences, onboardingCompleted, settings } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (name) user.name = name;
    if (accessibilityPreferences) user.accessibilityPreferences = accessibilityPreferences;
    if (typeof onboardingCompleted === "boolean") user.onboardingCompleted = onboardingCompleted;
    if (settings) user.settings = { ...user.settings, ...settings };
    await user.save();
    res.json({ user: { id: user._id, name: user.name, email: user.email, settings: user.settings } });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
}