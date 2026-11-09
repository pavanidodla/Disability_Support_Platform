import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "accessai-dev-secret";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function generateToken(user) {
  return jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}
