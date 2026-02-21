import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import { sendVerificationEmail } from "../services/email.js";
import { FRONTEND } from "../config.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "TOO_MANY_REQUESTS" },
  standardHeaders: true
});

const VERIFY_TOKEN_EXPIRY_HOURS = 24;

function generateVerifyToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** POST /auth/register - Đăng ký bằng email */
router.post("/register", authLimiter, async (req, res) => {
  const { email, password, name } = req.body || {};
  const emailTrim = typeof email === "string" ? email.trim().toLowerCase() : "";
  const passwordVal = typeof password === "string" ? password : "";
  const nameVal = typeof name === "string" ? name.trim() : "";

  if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return res.status(400).json({ error: "INVALID_EMAIL" });
  }
  if (passwordVal.length < 6) {
    return res.status(400).json({ error: "PASSWORD_TOO_SHORT" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(emailTrim);
  if (existing) {
    return res.status(400).json({ error: "EMAIL_EXISTS" });
  }

  const passwordHash = await bcrypt.hash(passwordVal, 10);
  const verifyToken = generateVerifyToken();
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO users (email, name, password_hash, email_verified, verify_token, verify_token_expires)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(emailTrim, nameVal || emailTrim.split("@")[0], passwordHash, verifyToken, expiresAt);

  const baseUrl = FRONTEND.replace(/\/$/, "");
  const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;
  sendVerificationEmail(emailTrim, nameVal || emailTrim, verifyUrl);

  return res.json({ ok: true, message: "CHECK_EMAIL" });
});

/** GET /auth/verify-email - Xác nhận email qua token (redirect) */
router.get("/verify-email", authLimiter, (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) {
    return res.redirect(`${FRONTEND}/verify-email?error=INVALID_TOKEN`);
  }

  const user = db.prepare(`
    SELECT id, email_verified FROM users WHERE verify_token=? AND verify_token_expires > datetime('now')
  `).get(token);

  if (!user) {
    return res.redirect(`${FRONTEND}/verify-email?error=EXPIRED_OR_INVALID`);
  }

  db.prepare("UPDATE users SET email_verified=1, verify_token=NULL, verify_token_expires=NULL WHERE id=?")
    .run(user.id);

  return res.redirect(`${FRONTEND}/verify-email?success=1`);
});

/** POST /auth/login - Đăng nhập bằng email + mật khẩu */
router.post("/login", authLimiter, async (req, res, next) => {
  const { email, password } = req.body || {};
  const emailTrim = typeof email === "string" ? email.trim().toLowerCase() : "";
  const passwordVal = typeof password === "string" ? password : "";

  if (!emailTrim || !passwordVal) {
    return res.status(400).json({ error: "INVALID_CREDENTIALS" });
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE email=? AND password_hash IS NOT NULL
  `).get(emailTrim);

  if (!user) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }

  const match = await bcrypt.compare(passwordVal, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }

  if (!user.email_verified) {
    return res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });
  }

  req.login(user, (err) => {
    if (err) return next(err);
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  });
});

export default router;
