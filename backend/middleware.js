export function isAdminEmail(email) {
  if (!email) return false;
  const admins = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(String(email).trim().toLowerCase());
}

export function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "LOGIN_REQUIRED" });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "LOGIN_REQUIRED" });
  if (!isAdminEmail(req.user.email)) return res.status(403).json({ error: "ADMIN_ONLY" });
  next();
}
