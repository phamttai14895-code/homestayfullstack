import nodemailer from "nodemailer";
import { db } from "../db.js";
import { escapeHtml } from "../helpers.js";

export function getMailTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  if (!host || !user) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE).toLowerCase() !== "false",
    auth: { user, pass: process.env.SMTP_PASS || "" }
  });
}

export function getBookingWithRoom(bookingId) {
  const b = db.prepare(`
    SELECT b.*, r.name AS room_name, r.location AS room_location
    FROM bookings b
    JOIN rooms r ON r.id = b.room_id
    WHERE b.id = ?
  `).get(bookingId);
  return b || null;
}

/** Gửi email xác nhận đăng ký (verify link). Gọi bất đồng bộ. */
export function sendVerificationEmail(email, name, verifyUrl) {
  const transport = getMailTransport();
  if (!transport) return;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Xác nhận email</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #0d9488;">Xác nhận đăng ký Homestay</h2>
  <p>Xin chào <strong>${escapeHtml(name || "Bạn")}</strong>,</p>
  <p>Vui lòng nhấn vào nút bên dưới để xác nhận địa chỉ email và kích hoạt tài khoản:</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; padding: 12px 24px; background: #0d9488; color: #fff !important; text-decoration: none; font-weight: bold; border-radius: 8px;">Xác nhận email</a>
  </p>
  <p style="color: #64748b; font-size: 13px;">Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký, vui lòng bỏ qua email này.</p>
  <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Trân trọng,<br/>Homestay</p>
</body>
</html>
  `.trim();

  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@homestay";
  transport.sendMail({
    from: fromAddr,
    to: email,
    subject: "[Homestay] Xác nhận địa chỉ email",
    html
  }).catch((err) => console.error("[Email] sendVerificationEmail failed:", err?.message || err));
}

/** Gửi email xác nhận đặt phòng + link Zalo OA. Gọi bất đồng bộ. */
export function sendBookingConfirmationEmail(bookingId) {
  const transport = getMailTransport();
  if (!transport) return;

  const b = getBookingWithRoom(bookingId);
  if (!b || !b.email) return;

  const zaloOALink = process.env.ZALO_OA_LINK || process.env.VITE_ZALO_LINK || "";
  const defaultCheckin = [
    "• Check-in: 14:00, Check-out: 12:00.",
    "• Liên hệ Zalo OA (link bên dưới) để nhận mật khẩu phòng và địa chỉ chi tiết.",
    "• Giữ gìn vệ sinh và tắt điện/điều hòa khi ra về."
  ].join("\n");
  const checkinInstructions = (process.env.CHECKIN_INSTRUCTIONS || defaultCheckin).replace(/\\n/g, "\n");

  const isHourly = String(b.booking_type || "").toLowerCase() === "hourly";
  const dateRange = isHourly
    ? `${b.check_in} ${b.check_in_time || ""} - ${b.check_out_time || ""}`
    : `${b.check_in} → ${b.check_out}`;
  const paymentNote = b.payment_status === "deposit_paid"
    ? ` (Đã thanh toán cọc ${Number(b.paid_amount || 0).toLocaleString()}đ, thanh toán nốt khi nhận phòng)`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Xác nhận đặt phòng</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #0d9488;">Xác nhận đặt phòng thành công</h2>
  <p>Xin chào <strong>${escapeHtml(b.full_name || "Quý khách")}</strong>,</p>
  <p>Đơn đặt phòng của bạn đã được xác nhận sau khi thanh toán thành công.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Mã đặt phòng</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${escapeHtml(b.lookup_code)}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Phòng</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${escapeHtml(b.room_name || "")} ${escapeHtml(b.room_location || "")}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Thời gian</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${escapeHtml(dateRange)}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Số khách</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${Number(b.guests || 1)}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Tổng tiền</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${Number(b.total_amount || 0).toLocaleString()}đ${paymentNote}</td></tr>
  </table>
  <div style="margin: 20px 0; padding: 16px; background: #f0fdfa; border-left: 4px solid #0d9488; border-radius: 6px;">
    <h3 style="margin: 0 0 10px 0; color: #0f766e;">Nhận mật khẩu phòng & hướng dẫn check-in</h3>
    <p style="margin: 0 0 12px 0;">Vui lòng nhấn vào link Zalo OA bên dưới để nhận <strong>mật khẩu phòng homestay</strong> và hướng dẫn check-in chi tiết:</p>
    ${zaloOALink ? `<p style="margin: 0;"><a href="${escapeHtml(zaloOALink)}" style="color: #0d9488; font-weight: bold;">${escapeHtml(zaloOALink)}</a></p>` : "<p style=\"margin: 0; color: #64748b;\">(Chủ nhà sẽ liên hệ qua số điện thoại / Zalo của bạn.)</p>"}
  </div>
  <div style="margin: 20px 0; padding: 12px; background: #f8fafc; border-radius: 6px; white-space: pre-line; font-size: 14px;">${escapeHtml(checkinInstructions)}</div>
  <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Trân trọng,<br/>Homestay</p>
</body>
</html>
  `.trim();

  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@homestay";
  transport.sendMail({
    from: fromAddr,
    to: b.email,
    subject: `[Homestay] Xác nhận đặt phòng ${b.lookup_code}`,
    html
  }).catch((err) => console.error("[Email] sendBookingConfirmation failed:", err?.message || err));
}

export function getAdminNotifyEmails() {
  const raw = process.env.ADMIN_NOTIFY_EMAILS || process.env.ADMIN_EMAILS || "";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text).slice(0, 4096),
      disable_web_page_preview: true
    })
  }).catch((err) => console.error("[Telegram] notify failed:", err?.message || err));
}

export function notifyAdminNewBooking(bookingId) {
  const b = getBookingWithRoom(bookingId);
  if (!b) return;

  const isHourly = String(b.booking_type || "").toLowerCase() === "hourly";
  const dateRange = isHourly
    ? `${b.check_in} ${b.check_in_time || ""} - ${b.check_out_time || ""}`
    : `${b.check_in} → ${b.check_out}`;
  const summary = [
    `🆕 Đơn đặt phòng mới #${b.id}`,
    `Mã: ${b.lookup_code}`,
    `Phòng: ${b.room_name || ""} ${b.room_location || ""}`,
    `Thời gian: ${dateRange}`,
    `Khách: ${b.full_name || "—"} • ${b.phone || "—"} • ${b.email || "—"}`,
    `Số khách: ${b.guests || 1}`,
    `Tổng tiền: ${Number(b.total_amount || 0).toLocaleString()}đ`,
    `Thanh toán: ${b.payment_method === "sepay" ? "Chuyển khoản" : "Tiền mặt"}`
  ].join("\n");

  sendTelegramMessage(summary);

  const transport = getMailTransport();
  const adminEmails = getAdminNotifyEmails();
  if (!transport || !adminEmails.length) return;

  const dashboardUrl = (process.env.ADMIN_DASHBOARD_URL || process.env.FRONTEND_ORIGIN || "").replace(/\/$/, "") + "/admin";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Đơn đặt phòng mới</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #0d9488;">🆕 Đơn đặt phòng mới</h2>
  <p>Có đơn đặt phòng mới trên hệ thống Homestay.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px; overflow: hidden;">
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Mã đơn</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">#${b.id} • ${escapeHtml(b.lookup_code)}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Phòng</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${escapeHtml(b.room_name || "")} ${escapeHtml(b.room_location || "")}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Thời gian</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${escapeHtml(dateRange)}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Khách</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${escapeHtml(b.full_name || "—")} • ${escapeHtml(b.phone || "—")} • ${escapeHtml(b.email || "—")}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Số khách</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${b.guests || 1}</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Tổng tiền</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${Number(b.total_amount || 0).toLocaleString()}đ</td></tr>
    <tr><td style="padding: 10px 12px; border: 1px solid #e2e8f0;"><strong>Thanh toán</strong></td><td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${b.payment_method === "sepay" ? "Chuyển khoản" : "Tiền mặt"}</td></tr>
  </table>
  ${dashboardUrl ? `<p><a href="${escapeHtml(dashboardUrl)}" style="color: #0d9488; font-weight: bold;">Vào trang quản trị</a></p>` : ""}
  <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Trân trọng,<br/>Hệ thống Homestay</p>
</body>
</html>
  `.trim();

  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@homestay";
  transport.sendMail({
    from: fromAddr,
    to: adminEmails.join(", "),
    subject: `[Homestay] Đơn đặt phòng mới #${b.id} - ${b.lookup_code}`,
    html
  }).catch((err) => console.error("[Email] notifyAdminNewBooking failed:", err?.message || err));
}
