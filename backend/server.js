import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import multer from "multer";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

import { PORT, FRONTEND, sessionSecret } from "./config.js";
import { db, parseJsonArray, decorateRoom } from "./db.js";
import { requireAdmin, isAdminEmail } from "./middleware.js";
import { cleanupExpiredSepay, onlyUploads, parseISODate, toDDMMYYYY } from "./helpers.js";
import { isCloudinaryConfigured, uploadBuffer, deleteByPublicId, getPublicIdFromUrl } from "./services/cloudinary.js";
import { getSepayBankInfo } from "./services/sepay.js";
import { sendBookingConfirmationEmail } from "./services/email.js";
import Database from "better-sqlite3";
import { syncGoogleSheetToBookings, schedulePushToGoogleSheet } from "./services/googleSheet.js";

import publicRouter from "./routes/public.js";
import authRouter from "./routes/auth.js";
import createUserRouter from "./routes/user.js";
import bookingsRouter from "./routes/bookings.js";
import paymentRouter from "./routes/payment.js";
import wishlistRouter from "./routes/wishlist.js";

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: FRONTEND, credentials: true }));
app.use(express.json({ limit: "5mb" }));

if (sessionSecret === "dev_secret" || sessionSecret === "change_me") {
  console.warn("⚠️ SESSION_SECRET đang dùng giá trị mặc định. Hãy đặt SESSION_SECRET trong .env khi chạy production.");
}
const isProduction = process.env.NODE_ENV === "production";

let sessionStore = undefined;
if (isProduction) {
  try {
    const require = createRequire(import.meta.url);
    const SqliteStore = require("better-sqlite3-session-store")(session);
    const sessionDbPath = path.join(process.cwd(), "data", "sessions.sqlite");
    fs.mkdirSync(path.dirname(sessionDbPath), { recursive: true });
    const sessionDb = new Database(sessionDbPath);
    sessionStore = new SqliteStore({
      client: sessionDb,
      expired: { clear: true, intervalMs: 15 * 60 * 1000 }
    });
  } catch (err) {
    console.warn("⚠️ Không dùng SQLite session store (dùng MemoryStore):", err.message);
  }
}

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* =========================
   Uploads (Cloudinary hoặc fallback local)
========================= */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

const useCloudinary = isCloudinaryConfigured();
const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || ".jpg").toLowerCase();
    const safe = `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safe);
  }
});
const upload = multer({
  storage: useCloudinary ? memoryStorage : diskStorage,
  limits: { fileSize: 8 * 1024 * 1024 }
});

/* =========================
   Google OAuth (safe init)
========================= */
passport.serializeUser((u, done) => done(null, u.id));
passport.deserializeUser((id, done) => {
  const u = db.prepare(`SELECT * FROM users WHERE id=?`).get(id);
  done(null, u || false);
});

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CB = process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`;

if (GOOGLE_ID && GOOGLE_SECRET) {
  passport.use(
    new GoogleStrategy(
      { clientID: GOOGLE_ID, clientSecret: GOOGLE_SECRET, callbackURL: GOOGLE_CB },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value || "";
        const name = profile.displayName || "";
        const avatar = profile.photos?.[0]?.value || "";
        const gid = profile.id;

        let u = db.prepare(`SELECT * FROM users WHERE email=?`).get(email);
        if (!u) {
          const info = db.prepare(
            `INSERT INTO users (google_id, email, name, avatar) VALUES (?,?,?,?)`
          ).run(gid, email, name, avatar);
          u = db.prepare(`SELECT * FROM users WHERE id=?`).get(info.lastInsertRowid);
        } else {
          db.prepare(`UPDATE users SET google_id=?, name=?, avatar=? WHERE id=?`)
            .run(gid, name, avatar, u.id);
          u = db.prepare(`SELECT * FROM users WHERE id=?`).get(u.id);
        }
        done(null, u);
      }
    )
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "TOO_MANY_REQUESTS" },
    standardHeaders: true
  });
  app.get("/auth/google", authLimiter, passport.authenticate("google", { scope: ["profile", "email"] }));
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: FRONTEND }),
    (req, res) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect(FRONTEND + "?error=session");
        }
        res.redirect(FRONTEND);
      });
    }
  );
} else {
  console.log("⚠️ Google OAuth disabled. Set GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET in backend/.env");
}

/* =========================
   Facebook OAuth
========================= */
const FACEBOOK_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_SECRET = process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_CB = process.env.FACEBOOK_CALLBACK_URL || `http://localhost:${PORT}/auth/facebook/callback`;

if (FACEBOOK_ID && FACEBOOK_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK_ID,
        clientSecret: FACEBOOK_SECRET,
        callbackURL: FACEBOOK_CB,
        profileFields: ["id", "displayName", "photos", "emails"]
      },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value || "";
        const name = profile.displayName || "";
        const avatar = profile.photos?.[0]?.value || "";
        const fid = profile.id;

        let u = email ? db.prepare(`SELECT * FROM users WHERE email=?`).get(email) : null;
        if (!u) {
          u = db.prepare(`SELECT * FROM users WHERE facebook_id=?`).get(fid);
        }
        if (!u) {
          const info = db.prepare(
            `INSERT INTO users (facebook_id, email, name, avatar) VALUES (?,?,?,?)`
          ).run(fid, email || null, name, avatar);
          u = db.prepare(`SELECT * FROM users WHERE id=?`).get(info.lastInsertRowid);
        } else {
          db.prepare(`UPDATE users SET facebook_id=?, name=?, avatar=? WHERE id=?`)
            .run(fid, name, avatar, u.id);
          u = db.prepare(`SELECT * FROM users WHERE id=?`).get(u.id);
        }
        done(null, u);
      }
    )
  );
  const authLimiter2 = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "TOO_MANY_REQUESTS" },
    standardHeaders: true
  });
  app.get("/auth/facebook", authLimiter2, passport.authenticate("facebook", { scope: ["email"] }));
  app.get(
    "/auth/facebook/callback",
    passport.authenticate("facebook", { failureRedirect: FRONTEND }),
    (req, res) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect(FRONTEND + "?error=session");
        }
        res.redirect(FRONTEND);
      });
    }
  );
} else {
  console.log("⚠️ Facebook OAuth disabled. Set FACEBOOK_APP_ID & FACEBOOK_APP_SECRET in backend/.env");
}

app.use("/auth", authRouter);
/* Link xác nhận email có thể dùng BACKEND_ORIGIN=https://domain.com/api → /api/auth/verify-email */
app.use("/api/auth", authRouter);

app.post("/auth/logout", (req, res) => {
  req.logout(() => {
    req.session?.destroy(() => res.json({ ok: true }));
  });
});

/* =========================
   API routers (public, user, bookings, payment)
========================= */
app.use("/api", publicRouter);
app.use("/api", createUserRouter(upload, { useCloudinary, uploadBuffer }));
app.use("/api", bookingsRouter);
app.use("/api", paymentRouter);
app.use("/api", wishlistRouter);

/* =========================
   ADMIN ROOMS + IMAGES
========================= */
app.get("/api/admin/rooms", requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM rooms ORDER BY id DESC`).all();
  res.json({ rooms: rows.map(decorateRoom) });
});

app.get("/api/admin/rooms/:id/day-prices", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const month = String(req.query.month || "").trim();
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "INVALID_MONTH" });
  }
  const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });
  const rows = db.prepare(`
    SELECT date_iso, price FROM room_day_prices
    WHERE room_id=? AND date_iso LIKE ?
    ORDER BY date_iso
  `).all(id, `${month}%`);
  const day_prices = {};
  for (const r of rows) day_prices[r.date_iso] = r.price;
  res.json({ room_id: id, month, day_prices });
});

app.put("/api/admin/rooms/:id/day-prices", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { date_iso, price } = req.body || {};
  if (!date_iso || !/^\d{4}-\d{2}-\d{2}$/.test(date_iso)) {
    return res.status(400).json({ error: "INVALID_DATE" });
  }
  const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });
  const p = Math.max(0, Number(price) || 0);
  db.prepare(`
    INSERT INTO room_day_prices (room_id, date_iso, price)
    VALUES (?, ?, ?)
    ON CONFLICT(room_id, date_iso) DO UPDATE SET price=excluded.price
  `).run(id, date_iso, p);
  const rows = db.prepare(`SELECT date_iso, price FROM room_day_prices WHERE room_id=? AND date_iso=?`).all(id, date_iso);
  res.json({ room_id: id, date_iso, price: rows[0]?.price ?? p });
});

app.post("/api/admin/rooms", requireAdmin, (req, res) => {
  const {
    name = "",
    location = "",
    price_per_night = 0,
    price_per_hour = 0,
    description = "",
    amenities = [],
    image_url = "",
    image_urls = []
  } = req.body || {};
  if (!String(name).trim()) return res.status(400).json({ error: "NAME_REQUIRED" });

  const imgList = onlyUploads(Array.isArray(image_urls) ? image_urls : []);
  const thumb = (image_url && imgList.includes(image_url)) ? image_url : (imgList[0] || "");

  const info = db.prepare(`
    INSERT INTO rooms (name, location, price_per_night, price_per_hour, image_url, image_urls, amenities, description)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    String(name).trim(),
    String(location || ""),
    Number(price_per_night || 0),
    Number(price_per_hour || 0),
    thumb,
    JSON.stringify(imgList),
    JSON.stringify(Array.isArray(amenities) ? amenities : []),
    String(description || "")
  );

  const r = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(info.lastInsertRowid);
  res.json({ room: decorateRoom(r) });
});

app.put("/api/admin/rooms/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!cur) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const body = req.body || {};
  const name = body.name !== undefined ? body.name : cur.name;
  const location = body.location !== undefined ? body.location : cur.location;
  const price_per_night = body.price_per_night !== undefined ? Number(body.price_per_night) || 0 : Number(cur.price_per_night || 0);
  const price_per_hour = body.price_per_hour !== undefined ? Number(body.price_per_hour) || 0 : Number(cur.price_per_hour || 0);
  const description = body.description !== undefined ? body.description : cur.description;
  const amenities = body.amenities !== undefined ? body.amenities : parseJsonArray(cur.amenities);
  const image_urls = body.image_urls !== undefined ? body.image_urls : parseJsonArray(cur.image_urls);
  const image_url = body.image_url !== undefined ? body.image_url : cur.image_url;

  const imgList = onlyUploads(Array.isArray(image_urls) ? image_urls : parseJsonArray(cur.image_urls));
  const thumb = (image_url && imgList.includes(image_url)) ? image_url : (imgList[0] || "");

  db.prepare(`
    UPDATE rooms
    SET name=?, location=?, price_per_night=?, price_per_hour=?, description=?, amenities=?, image_urls=?, image_url=?
    WHERE id=?
  `).run(
    String(name).trim(),
    String(location || ""),
    price_per_night,
    price_per_hour,
    String(description || ""),
    JSON.stringify(Array.isArray(amenities) ? amenities : []),
    JSON.stringify(imgList),
    thumb,
    id
  );

  const r = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  res.json({ room: decorateRoom(r) });
});

app.delete("/api/admin/rooms/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const urls = parseJsonArray(room.image_urls);
  for (const u of urls) {
    try {
      if (u.startsWith("/uploads/")) {
        const p = path.join(process.cwd(), u.replaceAll("/", path.sep));
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } else if (u.includes("cloudinary.com")) {
        const publicId = getPublicIdFromUrl(u);
        if (publicId) await deleteByPublicId(publicId);
      }
    } catch (e) { console.warn("[Admin] delete room image file failed:", e?.message || e); }
  }

  db.prepare(`DELETE FROM rooms WHERE id=?`).run(id);
  res.json({ success: true });
});

app.post("/api/admin/rooms/:id/images/upload", requireAdmin, upload.array("images", 20), async (req, res) => {
  const id = Number(req.params.id);
  const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const oldList = parseJsonArray(room.image_urls);
  let uploaded = [];
  if (useCloudinary && req.files?.length) {
    try {
      for (const f of req.files) {
        const { url } = await uploadBuffer(f.buffer, { folder: "homestay/rooms" });
        uploaded.push(url);
      }
    } catch (e) {
      return res.status(500).json({ error: "UPLOAD_FAILED", message: e?.message || "Cloudinary upload failed" });
    }
  } else if (req.files?.length) {
    uploaded = req.files.map(f => `/uploads/${f.filename}`);
  }
  const next = onlyUploads([...oldList, ...uploaded]);

  let thumb = room.image_url || "";
  if (!thumb || !next.includes(thumb)) thumb = next[0] || "";

  db.prepare(`UPDATE rooms SET image_urls=?, image_url=? WHERE id=?`)
    .run(JSON.stringify(next), thumb, id);

  const updated = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  res.json({ room: decorateRoom(updated) });
});

app.put("/api/admin/rooms/:id/thumbnail", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { url } = req.body || {};
  const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const list = parseJsonArray(room.image_urls);
  if (!url || typeof url !== "string" || !list.includes(url)) {
    return res.status(400).json({ error: "INVALID_THUMBNAIL" });
  }

  db.prepare(`UPDATE rooms SET image_url=? WHERE id=?`).run(url, id);
  const updated = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  res.json({ room: decorateRoom(updated) });
});

app.put("/api/admin/rooms/:id/images/reorder", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { image_urls, image_url } = req.body || {};
  if (!Array.isArray(image_urls)) return res.status(400).json({ error: "INVALID_IMAGE_URLS" });

  const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const cleaned = onlyUploads(image_urls);
  let thumb = typeof image_url === "string" ? image_url : room.image_url;
  if (!thumb || !cleaned.includes(thumb)) thumb = cleaned[0] || "";

  db.prepare(`UPDATE rooms SET image_urls=?, image_url=? WHERE id=?`)
    .run(JSON.stringify(cleaned), thumb, id);

  const updated = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  res.json({ room: decorateRoom(updated) });
});

app.delete("/api/admin/rooms/:id/images", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { url } = req.body || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "INVALID_URL" });

  const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const list = parseJsonArray(room.image_urls);
  const next = list.filter(u => u !== url);

  let thumb = room.image_url || "";
  if (thumb === url) thumb = next[0] || "";

  db.prepare(`UPDATE rooms SET image_urls=?, image_url=? WHERE id=?`)
    .run(JSON.stringify(next), thumb, id);

  try {
    if (url.startsWith("/uploads/")) {
      const p = path.join(process.cwd(), url.replaceAll("/", path.sep));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } else if (url.includes("cloudinary.com")) {
      const publicId = getPublicIdFromUrl(url);
      if (publicId) await deleteByPublicId(publicId);
    }
  } catch (e) { console.warn("[Admin] delete image file failed:", e?.message || e); }

  const updated = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  res.json({ room: decorateRoom(updated) });
});

/* =========================
   ADMIN BOOKINGS
========================= */
app.get("/api/admin/bookings", requireAdmin, (req, res) => {
  cleanupExpiredSepay();
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "all").trim();

  let where = "1=1";
  const params = [];

  if (status !== "all") {
    where += " AND b.status=?";
    params.push(status);
  }

  if (q) {
    where += " AND (b.lookup_code LIKE ? OR b.id = ? OR b.full_name LIKE ? OR b.phone LIKE ?)";
    params.push(`%${q}%`, Number(q) || -1, `%${q}%`, `%${q}%`);
  }

  const rows = db.prepare(`
    SELECT b.*, r.name room_name
    FROM bookings b JOIN rooms r ON r.id=b.room_id
    WHERE ${where}
    ORDER BY b.id DESC
    LIMIT 200
  `).all(...params);

  res.json({ bookings: rows, bank: getSepayBankInfo() });
});

app.put("/api/admin/bookings/:id/status", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const newStatus = String(req.body.status || "").toLowerCase();
  if (!["pending", "confirmed", "canceled"].includes(newStatus)) {
    return res.status(400).json({ error: "INVALID_STATUS" });
  }

  const b = db.prepare(`SELECT * FROM bookings WHERE id=?`).get(id);
  if (!b) return res.status(404).json({ error: "NOT_FOUND" });

  // sepay: confirmed khi paid hoặc deposit_paid
  if (b.payment_method === "sepay" && !["paid", "deposit_paid"].includes(String(b.payment_status || "")) && newStatus === "confirmed") {
    return res.status(400).json({ error: "SEPAY_NOT_PAID_YET" });
  }

  db.prepare(`UPDATE bookings SET status=? WHERE id=?`).run(newStatus, id);
  schedulePushToGoogleSheet();
  res.json({ success: true });
});

app.put("/api/admin/bookings/:id/payment", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { payment_status, paid_amount } = req.body || {};
  const ps = String(payment_status || "").toLowerCase();
  if (!["paid", "unpaid"].includes(ps)) {
    return res.status(400).json({ error: "INVALID_PAYMENT_STATUS" });
  }

  const b = db.prepare(`SELECT * FROM bookings WHERE id=?`).get(id);
  if (!b) return res.status(404).json({ error: "NOT_FOUND" });

  const amt =
    typeof paid_amount === "number"
      ? Math.max(0, Math.floor(paid_amount))
      : Number(b.paid_amount || 0);

  let nextStatus = b.status;
  if (ps === "paid" && b.payment_method === "cash" && b.status === "pending") {
    nextStatus = "confirmed";
  }

  db.prepare(`UPDATE bookings SET payment_status=?, paid_amount=?, status=? WHERE id=?`)
    .run(ps, amt, nextStatus, id);

  if (ps === "paid") {
    setImmediate(() => sendBookingConfirmationEmail(id));
  }
  schedulePushToGoogleSheet();

  res.json({ success: true });
});

app.delete("/api/admin/bookings/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM bookings WHERE id=?`).run(id);
  schedulePushToGoogleSheet();
  res.json({ success: true });
});

app.put("/api/admin/reviews/:id/reply", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "INVALID_ID" });
  const reply = typeof req.body?.reply === "string" ? req.body.reply.trim().slice(0, 2000) : "";
  const row = db.prepare(`SELECT id FROM reviews WHERE id=?`).get(id);
  if (!row) return res.status(404).json({ error: "NOT_FOUND" });
  const now = new Date().toISOString();
  db.prepare(`UPDATE reviews SET admin_reply=?, admin_reply_at=? WHERE id=?`).run(reply || null, reply ? now : null, id);
  const updated = db.prepare(`SELECT id, admin_reply, admin_reply_at FROM reviews WHERE id=?`).get(id);
  return res.json({ review: updated });
});

app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "INVALID_ID" });
    const row = db.prepare(`SELECT id, image_urls FROM reviews WHERE id=?`).get(id);
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    const urls = parseJsonArray(row.image_urls);
    for (const u of urls) {
      if (u.startsWith("/uploads/")) {
        const p = path.join(process.cwd(), u.replaceAll("/", path.sep));
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } else if (u.includes("cloudinary.com")) {
        const publicId = getPublicIdFromUrl(u);
        if (publicId) await deleteByPublicId(publicId);
      }
    }
    db.prepare(`DELETE FROM reviews WHERE id=?`).run(id);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/admin/sync-google-sheet", requireAdmin, (req, res) => {
  const roomNames = db.prepare("SELECT id, name FROM rooms ORDER BY id").all().map((r) => `${r.name} (id:${r.id})`);
  syncGoogleSheetToBookings()
    .then(({ synced, error, fetched, rawRowCount }) => {
      if (error) return res.status(400).json({ error, synced: synced || 0, fetched: fetched || 0, rawRowCount: rawRowCount || 0, roomNames });
      const msg = rawRowCount === 0
        ? "Sheet không có dữ liệu (hoặc range sai). Kiểm tra tab và dòng 2 trở đi."
        : synced === 0 && (fetched === 0 || rawRowCount > 0)
          ? "Không có dòng nào hợp lệ. Cột A phải là tên phòng hoặc ID (xem roomNames); B,C = ngày; D = pending hoặc confirmed."
          : "Đã đồng bộ " + synced + " đặt phòng từ Google Sheet. Lịch web đã cập nhật.";
      res.json({ synced, fetched: fetched || 0, rawRowCount: rawRowCount || 0, message: msg, roomNames });
    })
    .catch((err) => res.status(500).json({ error: String(err?.message || err) }));
});

/* =========================
   ADMIN: Thống kê & Doanh thu (?month=YYYY-MM để xem theo tháng)
========================= */
app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const monthParam = String(req.query.month || "").trim();
  const now = new Date();
  let periodStart, periodEnd, byMonth;

  if (/^\d{4}-\d{2}$/.test(monthParam)) {
    byMonth = true;
    periodStart = `${monthParam}-01`;
    const [y, m] = monthParam.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    periodEnd = `${monthParam}-${String(lastDay).padStart(2, "0")}`;
  } else {
    byMonth = false;
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    periodStart = twelveMonthsAgo.toISOString().slice(0, 10);
    periodEnd = now.toISOString().slice(0, 10);
  }

  const totalBookings = byMonth
    ? db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE date(check_in) >= ? AND date(check_in) <= ?`).get(periodStart, periodEnd)
    : db.prepare(`SELECT COUNT(*) AS n FROM bookings`).get();

  const rooms = db.prepare(`SELECT id FROM rooms`).all();
  const numRooms = rooms.length;
  const daysInPeriod = byMonth
    ? Math.ceil((new Date(periodEnd) - new Date(periodStart)) / 86400000) + 1
    : Math.ceil((now - new Date(periodStart)) / 86400000) || 1;
  const maxRoomNights = numRooms * daysInPeriod;

  const bookingsInPeriod = db.prepare(`
    SELECT id, room_id, check_in, check_out, booking_type, status
    FROM bookings
    WHERE status = 'confirmed'
      AND date(check_in) <= ?
      AND date(check_out) > ?
  `).all(periodEnd, periodStart);

  function nightsInPeriod(ci, co, isHourly) {
    if (isHourly) return 0.5;
    const a = parseISODate(ci);
    const b = parseISODate(co);
    if (!a || !b) return 0;
    const pStart = parseISODate(periodStart);
    const pEnd = parseISODate(periodEnd);
    if (!pStart || !pEnd) return 0;
    const overlapStart = a < pStart ? pStart : a;
    const overlapEnd = b > pEnd ? new Date(pEnd.getTime() + 86400000) : b;
    if (overlapStart >= overlapEnd) return 0;
    return Math.round((overlapEnd - overlapStart) / 86400000);
  }

  let totalRoomNights = 0;
  for (const b of bookingsInPeriod) {
    const isHourly = String(b.booking_type || "").toLowerCase() === "hourly";
    totalRoomNights += nightsInPeriod(b.check_in, b.check_out, isHourly);
  }
  const occupancyRate = maxRoomNights > 0 ? Math.round((totalRoomNights / maxRoomNights) * 10000) / 100 : 0;

  let revenueByMonth, revenueByDay;
  if (byMonth) {
    const dayRows = db.prepare(`
      SELECT
        check_in AS date_iso,
        SUM(CAST(paid_amount AS INTEGER)) AS revenue,
        COUNT(*) AS count
      FROM bookings
      WHERE status IN ('confirmed') AND date(check_in) >= ? AND date(check_in) <= ?
      GROUP BY date(check_in)
      ORDER BY date(check_in) ASC
    `).all(periodStart, periodEnd);
    revenueByDay = dayRows.map((r) => ({
      date: toDDMMYYYY(r.date_iso),
      date_iso: r.date_iso,
      revenue: Number(r.revenue || 0),
      count: Number(r.count || 0)
    }));
    revenueByMonth = [{
      month: monthParam,
      monthLabel: toDDMMYYYY(periodStart) + " - " + toDDMMYYYY(periodEnd),
      revenue: revenueByDay.reduce((a, d) => a + d.revenue, 0),
      count: revenueByDay.reduce((a, d) => a + d.count, 0)
    }];
  } else {
    const revenueRows = db.prepare(`
      SELECT
        strftime('%Y-%m', check_in) AS month,
        SUM(CAST(paid_amount AS INTEGER)) AS revenue,
        COUNT(*) AS count
      FROM bookings
      WHERE status IN ('confirmed') AND date(check_in) >= ? AND date(check_in) <= ?
      GROUP BY strftime('%Y-%m', check_in)
      ORDER BY month ASC
    `).all(periodStart, periodEnd);
    revenueByMonth = revenueRows.map((r) => ({
      month: r.month,
      monthLabel: toDDMMYYYY(r.month + "-01"),
      revenue: Number(r.revenue || 0),
      count: Number(r.count || 0)
    }));
    revenueByDay = null;
  }

  const totalRevenue = revenueByMonth.reduce((a, r) => a + r.revenue, 0);

  res.json({
    byMonth: !!byMonth,
    totalBookings: Number(totalBookings?.n || 0),
    totalRevenue,
    revenueByMonth,
    revenueByDay: revenueByDay || undefined,
    occupancyRate,
    totalRoomNights: Math.round(totalRoomNights * 10) / 10,
    maxRoomNights,
    numRooms,
    periodStart,
    periodEnd,
    periodStartFormatted: toDDMMYYYY(periodStart),
    periodEndFormatted: toDDMMYYYY(periodEnd)
  });
});

/* =========================
   Start
========================= */
app.listen(PORT, () => {
  console.log(`✅ Backend: http://localhost:${PORT}`);

  const pollMinutes = Number(process.env.GOOGLE_SHEETS_POLL_MINUTES || 0);
  if (pollMinutes > 0 && process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    const ms = pollMinutes * 60 * 1000;
    syncGoogleSheetToBookings()
      .then(({ synced, error }) => {
        if (error) console.warn("[GoogleSheets] startup sync failed:", error);
        else if (synced > 0) console.log("[GoogleSheets] startup synced", synced, "rows");
      })
      .catch((e) => console.warn("[GoogleSheets] startup sync error:", e?.message || e));
    setInterval(() => {
      syncGoogleSheetToBookings()
        .then(({ synced, error }) => {
          if (error) console.warn("[GoogleSheets] poll sync failed:", error);
          else if (synced > 0) console.log("[GoogleSheets] poll synced", synced, "rows");
        })
        .catch((e) => console.warn("[GoogleSheets] poll error:", e?.message || e));
    }, ms);
    console.log(`📊 Google Sheets: đồng bộ Sheet→Web mỗi ${pollMinutes} phút`);
  } else if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID && !pollMinutes) {
    console.log("📊 Google Sheets: POLL_MINUTES=0 → chỉ đồng bộ Sheet→Web khi admin bấm «Đồng bộ» hoặc set GOOGLE_SHEETS_POLL_MINUTES>0");
  }
});
