import { Router } from "express";
import { db, parseJsonArray, decorateRoom } from "../db.js";
import { isAdminEmail } from "../middleware.js";
import { cleanupExpiredSepay, isAfterCheckout, parseISODate, getDayPrice } from "../helpers.js";
import { getSepayBankInfo } from "../services/sepay.js";

const router = Router();

/** Tỉ giá VND/USD theo ngày — exchangerate-api.com v6 (có API key), cache theo ngày. */
let exchangeRateCache = { date: null, vndPerUsd: null, source: null };
const EXCHANGE_RATE_FALLBACK = Number(process.env.EXCHANGE_RATE_VND_PER_USD) || 25000;
const EXCHANGERATE_API_KEY = (process.env.EXCHANGERATE_API_KEY || "").trim();

async function fetchExchangerateApi() {
  const url = EXCHANGERATE_API_KEY
    ? `https://v6.exchangerate-api.com/v6/${EXCHANGERATE_API_KEY}/latest/USD`
    : "https://api.exchangerate-api.com/v4/latest/USD";
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Exchange API error");
  const data = await res.json();
  const vnd = data?.conversion_rates?.VND ?? data?.rates?.VND;
  if (typeof vnd === "number" && vnd > 0) return vnd;
  throw new Error("No VND rate");
}

router.get("/exchange-rate", async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  if (exchangeRateCache.date === today && exchangeRateCache.vndPerUsd != null) {
    return res.json({ vnd_per_usd: exchangeRateCache.vndPerUsd, date: today, source: exchangeRateCache.source });
  }
  let vnd = null;
  let source = "fallback";
  try {
    vnd = await fetchExchangerateApi();
    source = EXCHANGERATE_API_KEY ? "exchangerate-api-v6" : "exchangerate-api";
  } catch {
    vnd = EXCHANGE_RATE_FALLBACK;
  }
  if (vnd != null && vnd > 0) {
    exchangeRateCache = { date: today, vndPerUsd: vnd, source };
  }
  res.json({ vnd_per_usd: vnd || EXCHANGE_RATE_FALLBACK, date: today, source });
});

/** Bank info - public */
router.get("/bank-info", (_req, res) => {
  res.json(getSepayBankInfo());
});

/** Danh sách ngày lễ (public, dùng cho lịch đặt phòng) */
router.get("/holidays", (_req, res) => {
  const rows = db.prepare(`SELECT date_iso FROM holidays ORDER BY date_iso`).all();
  res.json({ holidays: rows.map((r) => r.date_iso) });
});

router.get("/me", (req, res) => {
  if (!req.user) return res.json({ user: null });
  let review_pending_count = 0;
  const rows = db.prepare(`
    SELECT id, status, check_in, check_out, booking_type, check_out_time
    FROM bookings WHERE user_id=?
  `).all(req.user.id);
  if (rows.length) {
    const ids = rows.map((b) => b.id);
    const reviewedSet = new Set(
      db.prepare(`SELECT booking_id FROM reviews WHERE booking_id IN (${ids.map(() => "?").join(",")})`).all(...ids).map((r) => r.booking_id)
    );
    for (const b of rows) {
      if (b.status === "confirmed" && isAfterCheckout(b) && !reviewedSet.has(b.id))
        review_pending_count += 1;
    }
  }
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      phone: req.user.phone ?? null,
      date_of_birth: req.user.date_of_birth ?? null,
      is_admin: isAdminEmail(req.user.email),
      review_pending_count
    }
  });
});

router.put("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "UNAUTHORIZED" });
  const { name, phone, date_of_birth, email } = req.body || {};
  const nameVal = typeof name === "string" ? name.trim() : req.user.name;
  const phoneVal = typeof phone === "string" ? phone.trim() : (req.user.phone ?? "");
  const dobVal = typeof date_of_birth === "string" ? date_of_birth.trim() : (req.user.date_of_birth ?? "");
  const emailVal = typeof email === "string" ? email.trim() : req.user.email;
  db.prepare(
    `UPDATE users SET name=?, phone=?, date_of_birth=?, email=? WHERE id=?`
  ).run(nameVal || null, phoneVal || null, dobVal || null, emailVal || null, req.user.id);
  const updated = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user.id);
  let review_pending_count = 0;
  const rows = db.prepare(`SELECT id, status, check_in, check_out, booking_type, check_out_time FROM bookings WHERE user_id=?`).all(updated.id);
  if (rows.length) {
    const ids = rows.map((b) => b.id);
    const reviewedSet = new Set(
      db.prepare(`SELECT booking_id FROM reviews WHERE booking_id IN (${ids.map(() => "?").join(",")})`).all(...ids).map((r) => r.booking_id)
    );
    for (const b of rows) {
      if (b.status === "confirmed" && isAfterCheckout(b) && !reviewedSet.has(b.id)) review_pending_count += 1;
    }
  }
  return res.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatar: updated.avatar,
      phone: updated.phone ?? null,
      date_of_birth: updated.date_of_birth ?? null,
      is_admin: isAdminEmail(updated.email),
      review_pending_count
    }
  });
});

router.get("/rooms", (req, res) => {
  cleanupExpiredSepay();
  const rows = db.prepare(`SELECT * FROM rooms ORDER BY id DESC`).all();
  const agg = db.prepare(`
    SELECT room_id, AVG(stars) AS avg_stars, COUNT(*) AS cnt
    FROM reviews GROUP BY room_id
  `).all();
  const byRoom = {};
  for (const a of agg) {
    byRoom[a.room_id] = {
      average_stars: Math.round(Number(a.avg_stars) * 10) / 10,
      review_count: Number(a.cnt)
    };
  }
  res.json({
    rooms: rows.map((r) => {
      const d = decorateRoom(r);
      const x = byRoom[r.id];
      return { ...d, average_stars: x?.average_stars ?? null, review_count: x?.review_count ?? 0 };
    })
  });
});

router.get("/rooms/:id/reviews", (req, res) => {
  const roomId = Number(req.params.id);
  const room = db.prepare(`SELECT id FROM rooms WHERE id=?`).get(roomId);
  if (!room) return res.status(404).json({ error: "NOT_FOUND" });
  const rows = db.prepare(`
    SELECT r.id, r.booking_id, r.room_id, r.stars, r.comment, r.image_urls, r.admin_reply, r.admin_reply_at, r.created_at, u.name AS user_name
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.room_id = ?
    ORDER BY r.created_at DESC
  `).all(roomId);
  const out = rows.map((r) => ({
    ...r,
    image_urls: parseJsonArray(r.image_urls)
  }));
  const sum = out.reduce((a, x) => a + Number(x.stars || 0), 0);
  const avg = out.length ? Math.round((sum / out.length) * 10) / 10 : null;
  res.json({ reviews: out, average_stars: avg, total: out.length });
});

router.get("/rooms/:id", (req, res) => {
  cleanupExpiredSepay();
  const id = Number(req.params.id);
  const r = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(id);
  if (!r) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ room: decorateRoom(r) });
});

router.get("/availability/:roomId", (req, res) => {
  cleanupExpiredSepay();
  const roomId = Number(req.params.roomId);
  const month = String(req.query.month || "").trim();
  const date = String(req.query.date || "").trim();

  const allBookings = db.prepare(`
    SELECT id, check_in, check_out, status, booking_type, check_in_time, check_out_time
    FROM bookings
    WHERE room_id=? AND status IN ('pending','confirmed')
  `).all(roomId);
  const blocks = allBookings.flatMap(b => {
    if (b.booking_type === "hourly") {
      const d = parseISODate(b.check_in);
      if (!d) return [];
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const nextIso = next.toISOString().slice(0, 10);
      return [{ ...b, check_in: b.check_in, check_out: nextIso }];
    }
    return [b];
  });

  let day_prices = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const customRows = db.prepare(`
      SELECT date_iso, price FROM room_day_prices
      WHERE room_id=? AND date_iso LIKE ?
    `).all(roomId, `${month}%`);
    for (const r of customRows) day_prices[r.date_iso] = Number(r.price);
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`;
      if (day_prices[iso] == null) day_prices[iso] = getDayPrice(roomId, iso);
    }
  }

  let hourly_slots = [];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    for (const b of allBookings) {
      if (b.booking_type === "hourly" && b.check_in === date && b.check_in_time && b.check_out_time) {
        hourly_slots.push({ start: b.check_in_time, end: b.check_out_time });
      } else if (!b.booking_type || b.booking_type === "overnight") {
        if (b.check_in <= date && date < b.check_out) {
          hourly_slots.push({ start: "00:00", end: "24:00" });
        }
      }
    }
  }

  res.json({ blocks, day_prices, hourly_slots: date ? hourly_slots : undefined });
});

router.get("/booking-search", (req, res) => {
  cleanupExpiredSepay();
  const { code, id, phone, email } = req.query;

  let b = null;
  if (id) {
    b = db.prepare(`
      SELECT b.*, r.name room_name, r.location room_location, r.price_per_night price_per_night, r.price_per_hour price_per_hour
      FROM bookings b JOIN rooms r ON r.id=b.room_id
      WHERE b.id=?
    `).get(Number(id));
  } else if (code) {
    b = db.prepare(`
      SELECT b.*, r.name room_name, r.location room_location, r.price_per_night price_per_night, r.price_per_hour price_per_hour
      FROM bookings b JOIN rooms r ON r.id=b.room_id
      WHERE b.lookup_code=?
    `).get(String(code).trim().toUpperCase());
  } else if (phone && email) {
    const rows = db.prepare(`
      SELECT b.*, r.name room_name, r.location room_location, r.price_per_night price_per_night, r.price_per_hour price_per_hour
      FROM bookings b JOIN rooms r ON r.id=b.room_id
      WHERE b.phone=? AND b.email=?
      ORDER BY b.id DESC LIMIT 3
    `).all(String(phone).trim(), String(email).trim());
    if (!rows.length) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ bookings: rows, bank: getSepayBankInfo() });
  } else {
    return res.status(400).json({ error: "MISSING_QUERY" });
  }

  if (!b) return res.status(404).json({ error: "NOT_FOUND" });

  res.json({ booking: b, bank: getSepayBankInfo() });
});

export default router;
