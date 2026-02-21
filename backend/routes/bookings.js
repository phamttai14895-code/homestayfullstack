import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import { requireLogin, isAdminEmail } from "../middleware.js";
import {
  cleanupExpiredSepay,
  parseISODate,
  daysBetween,
  parseTime,
  timeRangesOverlap,
  computeTotalFromDates,
  randomCode
} from "../helpers.js";
import { getSepayBankInfo, sepayBuildQr } from "../services/sepay.js";
import { notifyAdminNewBooking } from "../services/email.js";
import { schedulePushToGoogleSheet } from "../services/googleSheet.js";
import { ORDER_PREFIX, BOOKING_CODE_PREFIX, DEPOSIT_MIN, DEPOSIT_MAX, DEPOSIT_DEFAULT } from "../config.js";

const router = Router();

const bookingCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "TOO_MANY_REQUESTS" },
  standardHeaders: true
});

router.post("/bookings", bookingCreateLimiter, requireLogin, (req, res) => {
  try {
    cleanupExpiredSepay();

    const {
      room_id,
      booking_type = "overnight",
      full_name,
      phone,
      email,
      check_in,
      check_out,
      check_in_time,
      check_out_time,
      guests = 1,
      note = "",
      payment_method = "sepay",
      deposit_percent = DEPOSIT_DEFAULT,
      remainder_payment_method = "cash"
    } = req.body || {};

    const pm = String(payment_method).toLowerCase() === "cash" ? "cash" : "sepay";
    const remPM = String(remainder_payment_method || "cash").toLowerCase();
    const validRem = ["cash", "sepay"].includes(remPM) ? remPM : "cash";
    const isHourly = String(booking_type).toLowerCase() === "hourly";

    const roomId = Number(room_id);
    const room = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(roomId);
    if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

    const fullNameTrim = String(full_name || "").trim();
    const phoneTrim = String(phone || "").trim();
    const emailTrim = String(email || "").trim();
    if (!fullNameTrim) return res.status(400).json({ error: "MISSING_FULL_NAME" });
    if (!phoneTrim) return res.status(400).json({ error: "MISSING_PHONE" });
    if (!emailTrim) return res.status(400).json({ error: "MISSING_EMAIL" });

    const now = new Date();
    const todayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

    let checkInFinal, checkOutFinal, total, checkInTimeVal = null, checkOutTimeVal = null;

    if (isHourly) {
      const dateIso = String(check_in || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return res.status(400).json({ error: "INVALID_DATES" });
      if (dateIso < todayISO) return res.status(400).json({ error: "PAST_DATE" });
      const t1 = parseTime(check_in_time);
      const t2 = parseTime(check_out_time);
      if (t1 == null || t2 == null) return res.status(400).json({ error: "INVALID_TIMES" });
      if (t2 <= t1) return res.status(400).json({ error: "CHECKOUT_MUST_AFTER_CHECKIN" });
      const hours = (t2 - t1) / 60;
      if (hours < 1) return res.status(400).json({ error: "MIN_1_HOUR" });
      if (dateIso === todayISO && now.getHours() * 60 + now.getMinutes() >= t1) {
        return res.status(400).json({ error: "TODAY_AFTER_CHECKIN_TIME" });
      }
      checkInFinal = dateIso;
      checkOutFinal = dateIso;
      checkInTimeVal = String(check_in_time).trim();
      checkOutTimeVal = String(check_out_time).trim();
      total = Math.round(hours * Number(room.price_per_hour || 0));

      const existing = db.prepare(`
        SELECT check_in, check_out, booking_type, check_in_time, check_out_time
        FROM bookings WHERE room_id=? AND status IN ('pending','confirmed')
      `).all(roomId);
      for (const b of existing) {
        if (b.booking_type === "hourly" && b.check_in === dateIso) {
          if (timeRangesOverlap(checkInTimeVal, checkOutTimeVal, b.check_in_time, b.check_out_time)) {
            return res.status(409).json({ error: "BOOKING_OVERLAP" });
          }
        } else if (!b.booking_type || b.booking_type === "overnight") {
          if (b.check_in <= dateIso && dateIso < b.check_out) {
            return res.status(409).json({ error: "BOOKING_OVERLAP" });
          }
        }
      }
    } else {
      const inD = parseISODate(check_in);
      const outD = parseISODate(check_out);
      if (!inD || !outD) return res.status(400).json({ error: "INVALID_DATES" });
      if (check_in < todayISO) return res.status(400).json({ error: "PAST_DATE" });
      if (check_in === todayISO && now.getHours() >= 14) return res.status(400).json({ error: "TODAY_AFTER_CHECKIN_TIME" });
      const nights = daysBetween(check_in, check_out);
      if (nights <= 0) return res.status(400).json({ error: "CHECKOUT_MUST_AFTER_CHECKIN" });

      const overlap = db.prepare(`
        SELECT 1 FROM bookings WHERE room_id=? AND status IN ('pending','confirmed')
        AND (booking_type IS NULL OR booking_type = 'overnight')
        AND NOT (check_out <= ? OR check_in >= ?) LIMIT 1
      `).get(roomId, check_in, check_out);
      if (overlap) return res.status(409).json({ error: "BOOKING_OVERLAP" });
      const hourlyOnDays = db.prepare(`
        SELECT 1 FROM bookings WHERE room_id=? AND status IN ('pending','confirmed')
        AND booking_type='hourly' AND check_in >= ? AND check_in < ?
        LIMIT 1
      `).get(roomId, check_in, check_out);
      if (hourlyOnDays) return res.status(409).json({ error: "BOOKING_OVERLAP" });

      checkInFinal = check_in;
      checkOutFinal = check_out;
      total = computeTotalFromDates(roomId, check_in, check_out);
    }

    const g = Math.max(1, Number(guests) || 1);
    const rawDep = Number(deposit_percent);
    const depPct = pm === "sepay" ? (rawDep === 0 ? 0 : Math.max(DEPOSIT_MIN, Math.min(DEPOSIT_MAX, rawDep || DEPOSIT_DEFAULT))) : 0;
    const depositAmount = pm === "sepay" ? Math.floor(total * depPct / 100) : 0;

    const lookup = `${BOOKING_CODE_PREFIX}-${randomCode(6)}`;
    const ttl = Number(process.env.SEPAY_ORDER_TTL_SEC || 300);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const payAmount = pm === "sepay" ? (depositAmount > 0 ? depositAmount : total) : total;

    const info = db.prepare(`
      INSERT INTO bookings (
        room_id, user_id, full_name, phone, email,
        check_in, check_out, guests, note, booking_type, check_in_time, check_out_time,
        status, payment_method, payment_status,
        total_amount, paid_amount, deposit_percent, deposit_amount, remainder_payment_method,
        lookup_code, expires_at,
        sepay_order_code, sepay_qr_url, sepay_expired_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      roomId, req.user.id,
      fullNameTrim, phoneTrim, emailTrim,
      checkInFinal, checkOutFinal, g, String(note || ""),
      isHourly ? "hourly" : "overnight", checkInTimeVal, checkOutTimeVal,
      "pending", pm, "unpaid",
      total, 0, depPct, depositAmount, pm === "sepay" ? validRem : null,
      lookup, expiresAt,
      null, null, expiresAt
    );

    const bookingId = info.lastInsertRowid;

    let sepay = null;
    if (pm === "sepay") {
      const orderCode = `${ORDER_PREFIX}-${bookingId}-${lookup}`;
      const qr = sepayBuildQr({ amount: payAmount, content: orderCode });

      db.prepare(`
        UPDATE bookings SET sepay_order_code=?, sepay_qr_url=?, sepay_expired_at=? WHERE id=?
      `).run(orderCode, qr, expiresAt, bookingId);

      sepay = {
        bank_name: process.env.SEPAY_BANK_NAME || "",
        bank_account: process.env.SEPAY_BANK_ACCOUNT || "",
        amount: payAmount,
        total_amount: total,
        deposit_amount: depositAmount,
        remainder_payment_method: validRem,
        order_code: orderCode,
        qr_code_url: qr,
        expired_at: expiresAt
      };
    }

    const b = db.prepare(`
      SELECT b.*, r.name AS room_name, r.location AS room_location, r.price_per_night AS price_per_night
      FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?
    `).get(bookingId);

    setImmediate(() => notifyAdminNewBooking(bookingId));
    schedulePushToGoogleSheet();

    res.json({
      booking: b,
      sepay,
      next_step: pm === "sepay" ? "PAY_WITH_SEPAY" : "WAIT_ADMIN_CONFIRM"
    });
  } catch (err) {
    console.error("[Create booking] Error:", err?.message || err);
    res.status(500).json({ error: err?.message || "INTERNAL_ERROR" });
  }
});

router.get("/bookings/:id/payment", requireLogin, (req, res) => {
  cleanupExpiredSepay();
  const id = Number(req.params.id);
  const b = db.prepare(`SELECT * FROM bookings WHERE id=?`).get(id);
  if (!b) return res.status(404).json({ error: "NOT_FOUND" });

  if (!isAdminEmail(req.user.email) && b.user_id !== req.user.id) return res.status(403).json({ error: "FORBIDDEN" });

  const depositAmount = Number(b.deposit_amount || 0);
  const totalAmount = Number(b.total_amount || 0);
  const paidAmount = Number(b.paid_amount || 0);
  const remainder = totalAmount - paidAmount;
  const remainderMethod = String(b.remainder_payment_method || "").toLowerCase();
  const needRemainderSepay = remainder > 0 && remainderMethod === "sepay";
  const payNow = depositAmount > 0 && paidAmount < depositAmount
    ? depositAmount
    : needRemainderSepay ? remainder : remainder > 0 ? 0 : totalAmount;

  const ttlSec = Number(process.env.SEPAY_ORDER_TTL_SEC || 300);
  let qrUrl = b.sepay_qr_url;
  let expiredAt = b.sepay_expired_at || b.expires_at || null;
  const now = new Date();

  if (b.status === "pending" && b.payment_status !== "paid" && expiredAt && new Date(expiredAt) <= now) {
    db.prepare(`UPDATE bookings SET status='canceled' WHERE id=?`).run(id);
    const updated = db.prepare(`SELECT * FROM bookings WHERE id=?`).get(id);
    if (updated) {
      return res.json({
        booking: {
          id: updated.id, lookup_code: updated.lookup_code, status: updated.status,
          payment_method: updated.payment_method, payment_status: updated.payment_status,
          total_amount: Number(updated.total_amount || 0), paid_amount: Number(updated.paid_amount || 0),
          deposit_amount: Number(updated.deposit_amount || 0), deposit_percent: updated.deposit_percent,
          remainder_payment_method: updated.remainder_payment_method, remainder_amount: 0
        },
        sepay: null
      });
    }
  }

  if (b.payment_method === "sepay" && payNow > 0) {
    const orderCode = b.sepay_order_code || `${ORDER_PREFIX}-${b.id}-${b.lookup_code}`;
    const isExpired = expiredAt ? new Date(expiredAt) <= now : true;
    if (isExpired && b.status === "pending" && b.payment_status !== "paid") {
      const expired = new Date(now.getTime() + ttlSec * 1000).toISOString();
      qrUrl = sepayBuildQr({ amount: payNow, content: orderCode });
      expiredAt = expired;
      db.prepare(`UPDATE bookings SET sepay_qr_url=?, sepay_expired_at=? WHERE id=?`).run(qrUrl, expiredAt, id);
    }
  }

  res.json({
    booking: {
      id: b.id, lookup_code: b.lookup_code, status: b.status,
      payment_method: b.payment_method, payment_status: b.payment_status,
      total_amount: totalAmount, paid_amount: paidAmount, deposit_amount: depositAmount,
      deposit_percent: b.deposit_percent, remainder_payment_method: b.remainder_payment_method,
      remainder_amount: Math.max(0, remainder), expires_at: expiredAt || b.expires_at || null
    },
    sepay: b.payment_method === "sepay"
      ? {
          bank_name: process.env.SEPAY_BANK_NAME || "",
          bank_account: process.env.SEPAY_BANK_ACCOUNT || "",
          account_name: process.env.SEPAY_ACCOUNT_NAME || process.env.BANK_ACCOUNT_NAME || "",
          amount: payNow || totalAmount, total_amount: totalAmount, deposit_amount: depositAmount,
          paid_amount: paidAmount, remainder_amount: Math.max(0, remainder),
          order_code: b.sepay_order_code, qr_code_url: qrUrl || b.sepay_qr_url, expired_at: expiredAt
        }
      : null
  });
});

export default router;
