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
    return res.status(401).json({ success: false });
  }

  const body = req.body || {};
  // SePay payload: id, referenceCode, content, transferAmount, transferType
  const providerTxnId = String(
    body.referenceCode || body.id || body.txn_id || body.transactionId || body.transId || body.reference || ""
  ).trim();
  const amount = Number(body.transferAmount ?? body.amount ?? body.money ?? 0) || 0;
  const description = String(
    body.content || body.description || body.memo || body.note || body.transferContent || ""
  );
  const direction = String(body.transferType || body.direction || body.type || "").toLowerCase();
  const status = String(body.status || body.state || "").toUpperCase();

  const isIncoming = direction === "in" || direction === "credit" || direction === "incoming" || !direction;
  const isSuccess = status === "SUCCESS" || status === "PAID" || status === "COMPLETED" || !status;
  if (!isIncoming || !isSuccess) return res.json({ success: true });
  if (amount <= 0) return res.json({ success: true });

  const txnKey = providerTxnId || "noid_" + crypto.createHash("sha256").update(description + "|" + amount).digest("hex").slice(0, 32);

  try {
    db.prepare(`
      INSERT INTO payment_events (provider, provider_txn_id, amount, description)
      VALUES ('sepay', ?, ?, ?)
    `).run(txnKey, Math.floor(amount), description);
  } catch {
    return res.json({ success: true });
  }

  const b = findBookingByCodeFromDesc(description);
  if (!b) return res.json({ success: true });
  if (b.payment_method !== "sepay") return res.json({ success: true });
  if (b.payment_status === "paid") return res.json({ success: true });
  if (b.status === "canceled") return res.json({ success: true });

  db.prepare(`
    UPDATE payment_events SET booking_id=? WHERE provider='sepay' AND provider_txn_id=?
  `).run(b.id, txnKey);

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
  }

  return res.json({ success: true });
});

export default router;
