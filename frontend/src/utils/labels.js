/* =========================
   LABEL MAP – DÙNG CHUNG (PRO)
   - normalize: lowercase + fix typo "cancled"
========================= */

function norm(x) {
  return String(x || "")
    .trim()
    .toLowerCase();
}
function normBookingStatus(x) {
  const v = norm(x);
  if (v === "cancled") return "canceled"; // fix typo hay gặp
  return v;
}

export const BOOKING_STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  canceled: "Đã hủy"
};

export const PAYMENT_STATUS_LABEL = {
  paid: "Đã thanh toán",
  deposit_paid: "Đã cọc",
  unpaid: "Chưa thanh toán"
};


export const PAYMENT_METHOD_LABEL = {
  sepay: "Chuyển khoản",
  cash: "Tiền mặt"
};

/* =========================
   HELPER FUNCTIONS
========================= */

export function bookingStatusLabel(status) {
  const s = normBookingStatus(status);
  return BOOKING_STATUS_LABEL[s] || (status ? String(status) : "—");
}

export function paymentStatusLabel(status) {
  const s = norm(status);
  return PAYMENT_STATUS_LABEL[s] || (status ? String(status) : "—");
}

/** Trạng thái thanh toán hiển thị: nếu đã trả đủ (paid_amount >= total) thì coi là "paid". */
export function getDisplayPaymentStatus(booking) {
  if (!booking) return "unpaid";
  const ps = norm(booking.payment_status || "");
  const total = Number(booking.total_amount || 0);
  const paid = Number(booking.paid_amount || 0);
  if (total > 0 && paid >= total) return "paid";
  return ps || "unpaid";
}

export function paymentMethodLabel(method) {
  const m = norm(method);
  return PAYMENT_METHOD_LABEL[m] || (method ? String(method) : "—");
}

/* =========================
   I18N KEYS – for use with t()
========================= */

export function getBookingStatusKey(status) {
  const s = normBookingStatus(status);
  return `labels.booking_status_${s}`;
}

export function getPaymentStatusKey(status) {
  const s = norm(status);
  return `labels.payment_status_${s}`;
}

export function getPaymentMethodKey(method) {
  const m = norm(method);
  return `labels.payment_method_${m}`;
}

/* =========================
   BADGE CLASS MAP (giữ màu)
   - return className đúng như CSS bạn đang dùng
========================= */

export function bookingStatusClass(status) {
  const s = normBookingStatus(status);
  if (s === "pending") return "badge pending";
  if (s === "confirmed") return "badge confirmed";
  if (s === "canceled") return "badge canceled";
  return "badge";
}

export function paymentStatusClass(status) {
  if (status === "paid") return "badge confirmed";
  if (status === "deposit_paid") return "badge confirmed"; // ✅ cọc xong cũng coi là OK
  if (status === "unpaid") return "badge pending";
  return "badge";
}

