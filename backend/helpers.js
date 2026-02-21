import { db } from "./db.js";

/** Escape ký tự đặc biệt HTML (dùng trong email HTML, tránh XSS). */
export function escapeHtml(str) {
  if (str == null) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseISODate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function daysBetween(ciISO, coISO) {
  const a = parseISODate(ciISO);
  const b = parseISODate(coISO);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** True nếu thời điểm hiện tại đã qua thời điểm checkout của booking. */
export function isAfterCheckout(booking) {
  const now = new Date();
  const isHourly = String(booking.booking_type || "").toLowerCase() === "hourly";
  if (isHourly && booking.check_in && booking.check_out_time) {
    const timePart = String(booking.check_out_time).trim();
    const withSeconds = /^\d{1,2}:\d{2}$/.test(timePart) ? `${timePart}:00` : timePart;
    const checkoutMoment = new Date(`${booking.check_in}T${withSeconds}`);
    return now.getTime() > checkoutMoment.getTime();
  }
  if (!booking.check_out) return false;
  const checkoutMoment = new Date(`${booking.check_out}T12:00:00`);
  return now.getTime() > checkoutMoment.getTime();
}

export function parseTime(s) {
  if (!/^\d{1,2}:\d{2}$/.test(String(s || ""))) return null;
  const [h, m] = String(s).split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const a1 = parseTime(aStart), a2 = parseTime(aEnd);
  const b1 = parseTime(bStart), b2 = parseTime(bEnd);
  if (a1 == null || a2 == null || b1 == null || b2 == null) return false;
  return a1 < b2 && a2 > b1;
}

/** Giá phòng cho một ngày: ưu tiên room_day_prices, fallback price_per_night. */
export function getDayPrice(roomId, dateIso) {
  const room = db.prepare(`SELECT price_per_night FROM rooms WHERE id=?`).get(roomId);
  const defaultPrice = room ? Number(room.price_per_night || 0) : 0;
  const row = db.prepare(
    `SELECT price FROM room_day_prices WHERE room_id=? AND date_iso=?`
  ).get(roomId, dateIso);
  return row != null ? Number(row.price) : defaultPrice;
}

/** Tổng tiền qua đêm: cộng giá từng ngày từ check_in đến trước check_out. */
export function computeTotalFromDates(roomId, checkInIso, checkOutIso) {
  let total = 0;
  const start = parseISODate(checkInIso);
  const end = parseISODate(checkOutIso);
  if (!start || !end || end <= start) return 0;
  const cur = new Date(start);
  while (cur < end) {
    const iso = cur.toISOString().slice(0, 10);
    total += getDayPrice(roomId, iso);
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}

export function nowISO() {
  return new Date().toISOString();
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

/** Hủy đơn pending hết hạn thanh toán (SePay/expires_at). */
export function cleanupExpiredSepay() {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE bookings SET status='canceled'
    WHERE status='pending' AND payment_status != 'paid'
    AND (sepay_expired_at IS NOT NULL AND sepay_expired_at <= ?)
  `).run(now);
}

/** Kiểm tra URL có phải từ upload hợp lệ không (/uploads/ hoặc Cloudinary). */
export function isValidImageUrl(url) {
  if (typeof url !== "string" || url.length > 500) return false;
  return url.startsWith("/uploads/") || url.includes("res.cloudinary.com");
}

/** Chỉ giữ URL upload hợp lệ (bắt đầu /uploads/ hoặc Cloudinary, độ dài < 500). */
export function onlyUploads(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.filter(isValidImageUrl);
}

const ORDER_PREFIX = (process.env.ORDER_PREFIX || "HS").toUpperCase();
const BOOKING_CODE_PREFIX = (process.env.BOOKING_CODE_PREFIX || "NVH").toUpperCase();

/** Tìm booking từ nội dung chuyển khoản (order code hoặc lookup_code trong description). */
export function findBookingByCodeFromDesc(description) {
  const desc = String(description || "").trim();
  if (!desc) return null;
  const prefix = ORDER_PREFIX + "-";
  const codePrefix = BOOKING_CODE_PREFIX + "-";
  let id = null;
  let code = null;
  if (desc.startsWith(prefix)) {
    const rest = desc.slice(prefix.length);
    const match = rest.match(/^(\d+)-/);
    if (match) id = parseInt(match[1], 10);
  }
  const codeMatch = desc.match(new RegExp(codePrefix + "([A-Z0-9]{6})", "i"));
  if (codeMatch) code = codeMatch[0].toUpperCase();
  if (id) {
    const b = db.prepare(`SELECT * FROM bookings WHERE id=?`).get(id);
    if (b) return b;
  }
  if (code) {
    const b = db.prepare(`SELECT * FROM bookings WHERE lookup_code=?`).get(code);
    if (b) return b;
  }
  return null;
}

export function toDDMMYYYY(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}
