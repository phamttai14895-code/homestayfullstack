import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { findBookingByCodeFromDesc } from "../helpers.js";
import { sendBookingConfirmationEmail } from "../services/email.js";
import { schedulePushToGoogleSheet } from "../services/googleSheet.js";

const router = Router();

/** SePay xác thực qua header "Authorization":"Apikey API_KEY" — không dùng webhook secret */
function validateSepayAuth(req) {
  const apiKey = process.env.SEPAY_API_KEY;
  if (!apiKey) return false;
  const auth = req.headers.authorization || "";
  return auth === "Apikey " + apiKey || auth === "apikey " + apiKey;
}

router.post("/sepay/webhook", (req, res) => {
  if (!validateSepayAuth(req)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[SePay webhook] 401: thiếu hoặc sai Authorization header (Apikey SEPAY_API_KEY)");
    }
    return res.status(401).json({ success: false });
  }

  const body = req.body || {};
  // SePay payload: id, referenceCode, content, code (mã thanh toán tự nhận dạng), transferAmount, transferType
  const providerTxnId = String(
    body.referenceCode || body.id || body.txn_id || body.transactionId || body.transId || body.reference || ""
  ).trim();
  const amount = Number(body.transferAmount ?? body.amount ?? body.money ?? 0) || 0;
  // code = mã thanh toán SePay tự nhận (Company → Payment Code Structure); content = nội dung chuyển khoản
  const description = String(
    body.code || body.content || body.description || body.memo || body.note || body.transferContent || ""
  ).trim();
  const direction = String(body.transferType || body.direction || body.type || "").toLowerCase();
  const status = String(body.status || body.state || "").toUpperCase();

  if (process.env.NODE_ENV !== "production") {
    console.log("[SePay webhook] payload:", { referenceCode: body.referenceCode, amount, content: body.content, code: body.code, transferType: body.transferType });
  } else {
    console.log("[SePay webhook] received amount=" + amount + " transferType=" + direction + " content=" + (description?.slice(0, 60) || ""));
  }

  const isIncoming = direction === "in" || direction === "credit" || direction === "incoming" || !direction;
  const isSuccess = status === "SUCCESS" || status === "PAID" || status === "COMPLETED" || !status;
  if (!isIncoming || !isSuccess) return res.json({ success: true });
  if (amount <= 0) return res.json({ success: true });

  const txnKey = providerTxnId || "noid_" + crypto.createHash("sha256").update(description + "|" + amount).digest("hex").slice(0, 32);

  let inserted = true;
  try {
    db.prepare(`
      INSERT INTO payment_events (provider, provider_txn_id, amount, description)
      VALUES ('sepay', ?, ?, ?)
    `).run(txnKey, Math.floor(amount), description);
  } catch (err) {
    inserted = false;
    if (process.env.NODE_ENV !== "production" && !/UNIQUE|SQLITE_CONSTRAINT/.test(String(err?.message || ""))) {
      console.warn("[SePay webhook] INSERT payment_events:", err?.message);
    }
  }

  const b = findBookingByCodeFromDesc(description);
  if (!b) {
    console.log("[SePay webhook] Không tìm thấy booking cho nội dung:", description?.slice(0, 80) || "(rỗng)");
    return res.json({ success: true });
  }
  if (b.payment_method !== "sepay") return res.json({ success: true });
  if (b.payment_status === "paid") return res.json({ success: true });
  if (b.status === "canceled") return res.json({ success: true });

  db.prepare(`
    UPDATE payment_events SET booking_id=? WHERE provider='sepay' AND provider_txn_id=?
  `).run(b.id, txnKey);

  // Chỉ cộng tiền khi đây là event mới (vừa INSERT). Trùng (retry) thì không cộng lại.
  if (!inserted) return res.json({ success: true });

  const total = Number(b.total_amount || 0);
  const deposit = Number(b.deposit_amount || 0);
  const paid = Math.floor(amount);
  const prevPaid = Number(b.paid_amount || 0);
  const newPaid = prevPaid + paid;

  if (paid > 0) {
    let nextStatus = b.status;
    let paymentStatus = b.payment_status;
    if (newPaid >= total) {
      paymentStatus = "paid";
      nextStatus = "confirmed";
    } else if (deposit > 0 && newPaid >= deposit) {
      paymentStatus = "deposit_paid";
      nextStatus = "confirmed";
    }
    db.prepare(`
      UPDATE bookings SET payment_status=?, paid_amount=?, status=? WHERE id=?
    `).run(paymentStatus, newPaid, nextStatus, b.id);

    if (paymentStatus === "paid" || paymentStatus === "deposit_paid") {
      setImmediate(() => sendBookingConfirmationEmail(b.id));
    }
    schedulePushToGoogleSheet();
    console.log("[SePay webhook] Đã cập nhật booking id=" + b.id + " payment_status=" + paymentStatus + " paid_amount=" + newPaid);
  }

  return res.json({ success: true });
});

export default router;
