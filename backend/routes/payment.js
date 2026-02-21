import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { findBookingByCodeFromDesc } from "../helpers.js";
import { sendBookingConfirmationEmail } from "../services/email.js";
import { schedulePushToGoogleSheet } from "../services/googleSheet.js";

const router = Router();

router.post("/sepay/webhook/:secret", (req, res) => {
  if (req.params.secret !== process.env.SEPAY_WEBHOOK_SECRET) {
    return res.status(401).json({ success: false });
  }

  const body = req.body || {};
  const providerTxnId = String(
    body.txn_id || body.transactionId || body.id || body.transId || body.reference || ""
  ).trim();
  const amount = Number(body.amount ?? body.transferAmount ?? body.money ?? 0) || 0;
  const description = String(
    body.description || body.content || body.memo || body.note || body.transferContent || ""
  );
  const direction = String(body.direction || body.transferType || body.type || "").toLowerCase();
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
