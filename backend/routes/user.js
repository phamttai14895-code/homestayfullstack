import { Router } from "express";
import { db, parseJsonArray } from "../db.js";
import { requireLogin } from "../middleware.js";
import { cleanupExpiredSepay, isAfterCheckout, onlyUploads } from "../helpers.js";
import { getSepayBankInfo } from "../services/sepay.js";

/** Router cho my-bookings và reviews. Cần truyền multer upload và tùy chọn Cloudinary. */
export default function createUserRouter(upload, cloudinaryOpts = {}) {
  const { useCloudinary = false, uploadBuffer } = cloudinaryOpts;
  const router = Router();

  router.get("/my-bookings", requireLogin, (req, res) => {
    cleanupExpiredSepay();

    const rows = db.prepare(`
      SELECT 
        b.*,
        r.name AS room_name,
        r.location AS room_location,
        r.price_per_night AS price_per_night,
        r.price_per_hour AS price_per_hour
      FROM bookings b
      JOIN rooms r ON r.id=b.room_id
      WHERE b.user_id=?
      ORDER BY b.id DESC
    `).all(req.user.id);

    const bookingIds = rows.map((b) => b.id);
    const reviewedSet = new Set(
      bookingIds.length
        ? db.prepare(`SELECT booking_id FROM reviews WHERE booking_id IN (${bookingIds.map(() => "?").join(",")})`).all(...bookingIds).map((r) => r.booking_id)
        : []
    );

    const bookings = rows.map((b) => {
      const has_review = reviewedSet.has(b.id);
      const can_review =
        b.status === "confirmed" && isAfterCheckout(b) && !has_review;
      return { ...b, has_review, can_review };
    });

    res.json({ bookings, bank: getSepayBankInfo() });
  });

  router.post("/reviews", requireLogin, upload.array("images", 6), async (req, res) => {
    const body = req.body || {};
    const bookingId = Number(body.booking_id);
    if (!bookingId) return res.status(400).json({ error: "MISSING_BOOKING_ID" });

    const booking = db.prepare(
      `SELECT id, room_id, user_id, status, check_in, check_out, booking_type, check_out_time FROM bookings WHERE id=?`
    ).get(bookingId);
    if (!booking) return res.status(404).json({ error: "BOOKING_NOT_FOUND" });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: "NOT_YOUR_BOOKING" });
    if (booking.status !== "confirmed") return res.status(400).json({ error: "ONLY_CONFIRMED" });
    if (!isAfterCheckout(booking)) return res.status(400).json({ error: "AFTER_CHECKOUT_ONLY" });

    const existing = db.prepare(`SELECT id FROM reviews WHERE booking_id=?`).get(bookingId);
    if (existing) return res.status(400).json({ error: "ALREADY_REVIEWED" });

    const starsNum = Math.min(5, Math.max(1, Number(body.stars) || 5));
    const commentStr = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "";
    let imageUrls = [];
    if (useCloudinary && uploadBuffer && req.files?.length) {
      try {
        for (const f of req.files) {
          const { url } = await uploadBuffer(f.buffer, { folder: "homestay/reviews" });
          imageUrls.push(url);
        }
      } catch (e) {
        return res.status(500).json({ error: "UPLOAD_FAILED", message: e?.message || "Cloudinary upload failed" });
      }
    } else {
      imageUrls = onlyUploads((req.files || []).map((f) => `/uploads/${f.filename}`));
    }
    const imageUrlsJson = imageUrls.length ? JSON.stringify(imageUrls) : null;

    db.prepare(
      `INSERT INTO reviews (booking_id, room_id, user_id, stars, comment, image_urls) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(bookingId, booking.room_id, req.user.id, starsNum, commentStr, imageUrlsJson);

    const row = db.prepare(
      `SELECT id, booking_id, room_id, stars, comment, image_urls, created_at FROM reviews WHERE booking_id=?`
    ).get(bookingId);
    row.image_urls = parseJsonArray(row.image_urls);
    res.status(201).json({ review: row });
  });

  return router;
}
