export const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

/** Trả về URL ảnh đầy đủ. Cloudinary đã là URL tuyệt đối, /uploads/ cần prepend BASE. */
export function imageUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function parseResponse(res, options = {}) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) { /* ignore JSON parse error for non-JSON response */ }
  if (!res.ok) {
    const defaultMsg = res.status ? `Lỗi ${res.status}` : "REQUEST_FAILED";
    const msg = data?.error || data?.message || (options.friendly404 && res.status === 404 && text?.length < 80 ? "Không tìm thấy (404). Khởi động lại backend nếu vừa thêm API." : defaultMsg);
    throw new Error(msg);
  }
  return data;
}

function j(res) {
  return parseResponse(res, { friendly404: true });
}

/* auth */
export async function fetchMe() {
  return j(await fetch(`${BASE}/api/me`, { credentials: "include" }));
}
export async function updateProfile(payload) {
  return j(await fetch(`${BASE}/api/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  }));
}
export async function logout() {
  return j(await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" }));
}

/** Đăng ký bằng email (gửi email xác nhận) */
export async function register(payload) {
  return j(await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  }));
}

/** Gửi lại link xác nhận đăng ký (token mới gửi vào email) */
export async function resendVerifyEmail(email) {
  return j(await fetch(`${BASE}/auth/resend-verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: email.trim() })
  }));
}

/** Đăng nhập bằng email + mật khẩu */
export async function loginEmail(email, password) {
  return j(await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
  }));
}

/* public */
export async function fetchBankInfo() {
  return j(await fetch(`${BASE}/api/bank-info`));
}

/** Danh sách ngày lễ (public, dùng cho lịch đặt phòng) */
export async function fetchHolidays() {
  return j(await fetch(`${BASE}/api/holidays`));
}

/** Tỉ giá VND/USD theo ngày (1 USD = x VND) */
export async function fetchExchangeRate() {
  return j(await fetch(`${BASE}/api/exchange-rate`));
}

export async function fetchRooms() {
  return j(await fetch(`${BASE}/api/rooms`));
}
export async function fetchRoomDetail(id) {
  return j(await fetch(`${BASE}/api/rooms/${id}`));
}

export async function fetchRoomReviews(roomId) {
  return j(await fetch(`${BASE}/api/rooms/${roomId}/reviews`));
}

export async function createReview(bookingId, stars, comment, imageFiles = []) {
  const fd = new FormData();
  fd.append("booking_id", String(bookingId));
  fd.append("stars", String(stars));
  fd.append("comment", String(comment || ""));
  for (const f of imageFiles) fd.append("images", f);
  return j(await fetch(`${BASE}/api/reviews`, {
    method: "POST",
    credentials: "include",
    body: fd
  }));
}

export async function adminReplyReview(reviewId, reply) {
  return j(await fetch(`${BASE}/api/admin/reviews/${reviewId}/reply`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ reply: String(reply || "") })
  }));
}

export async function adminDeleteReview(reviewId) {
  return j(await fetch(`${BASE}/api/admin/reviews/${reviewId}`, {
    method: "DELETE",
    credentials: "include"
  }));
}

export async function fetchAvailability(roomId, month, date) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (date) params.set("date", date);
  const qs = params.toString();
  return j(await fetch(`${BASE}/api/availability/${roomId}${qs ? "?" + qs : ""}`));
}

/* booking */
export async function createBooking(payload) {
  return j(await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  }));
}

export async function bookingSearch(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/api/booking-search?${qs}`, { credentials: "include" });
  return parseResponse(res);
}


export async function myBookings() {
  return j(await fetch(`${BASE}/api/my-bookings`, { credentials: "include" }));
}

/* wishlist */
export async function fetchWishlist() {
  return j(await fetch(`${BASE}/api/wishlist`, { credentials: "include" }));
}
export async function addToWishlist(roomId) {
  return j(await fetch(`${BASE}/api/wishlist/${roomId}`, { method: "POST", credentials: "include" }));
}
export async function removeFromWishlist(roomId) {
  return j(await fetch(`${BASE}/api/wishlist/${roomId}`, { method: "DELETE", credentials: "include" }));
}

export async function fetchBookingPayment(id) {
  return j(await fetch(`${BASE}/api/bookings/${id}/payment`, { credentials: "include" }));
}

/* admin rooms */
export async function adminRooms() {
  return j(await fetch(`${BASE}/api/admin/rooms`, { credentials: "include" }));
}
export async function adminCreateRoom(payload) {
  return j(await fetch(`${BASE}/api/admin/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  }));
}
export async function adminUpdateRoom(id, payload) {
  return j(await fetch(`${BASE}/api/admin/rooms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  }));
}
export async function adminDeleteRoom(id) {
  return j(await fetch(`${BASE}/api/admin/rooms/${id}`, {
    method: "DELETE",
    credentials: "include"
  }));
}

export async function adminUploadRoomImages(roomId, files) {
  const fd = new FormData();
  for (const f of files) fd.append("images", f);
  return j(await fetch(`${BASE}/api/admin/rooms/${roomId}/images/upload`, {
    method: "POST",
    credentials: "include",
    body: fd
  }));
}

export async function adminSetThumbnail(roomId, url) {
  return j(await fetch(`${BASE}/api/admin/rooms/${roomId}/thumbnail`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url })
  }));
}

export async function adminReorderRoomImages(roomId, image_urls, image_url) {
  return j(await fetch(`${BASE}/api/admin/rooms/${roomId}/images/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ image_urls, image_url })
  }));
}

export async function adminDayPrices(roomId, month) {
  return j(await fetch(`${BASE}/api/admin/rooms/${roomId}/day-prices?month=${encodeURIComponent(month)}`, { credentials: "include" }));
}
export async function adminSetRoomPricePresets(roomId, { price_weekday, price_weekend, price_holiday }) {
  return j(await fetch(`${BASE}/api/admin/rooms/${roomId}/price-presets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ price_weekday, price_weekend, price_holiday })
  }));
}

export async function adminHolidays() {
  return j(await fetch(`${BASE}/api/admin/holidays`, { credentials: "include" }));
}

export async function adminAddHoliday(date_iso) {
  return j(await fetch(`${BASE}/api/admin/holidays`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ date_iso })
  }));
}

export async function adminRemoveHoliday(date_iso) {
  return j(await fetch(`${BASE}/api/admin/holidays/${encodeURIComponent(date_iso)}`, {
    method: "DELETE",
    credentials: "include"
  }));
}

/** Import ngày lễ Việt Nam (2024–2028). body.years = [2025, 2026] hoặc để trống = tất cả. */
export async function adminImportVietnamHolidays(years = []) {
  return j(await fetch(`${BASE}/api/admin/holidays/import-vietnam`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ years })
  }));
}

export async function adminSetDayPrice(roomId, date_iso, price) {
  return j(await fetch(`${BASE}/api/admin/rooms/${roomId}/day-prices`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ date_iso, price })
  }));
}

export async function adminDeleteImage(roomId, url) {
  return j(await fetch(`${BASE}/api/admin/rooms/${roomId}/images`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url })
  }));
}

/* admin bookings */
export async function adminBookings({ q = "", status = "all", source = "all" } = {}) {
  const qs = new URLSearchParams({ q, status, source }).toString();
  return j(await fetch(`${BASE}/api/admin/bookings?${qs}`, { credentials: "include" }));
}

export async function adminGetBooking(id) {
  return j(await fetch(`${BASE}/api/admin/bookings/${id}`, { credentials: "include" }));
}
export async function adminSetBookingStatus(id, status) {
  return j(await fetch(`${BASE}/api/admin/bookings/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status })
  }));
}
export async function adminSetBookingPayment(id, payment_status, paid_amount) {
  return j(await fetch(`${BASE}/api/admin/bookings/${id}/payment`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ payment_status, paid_amount })
  }));
}
export async function adminDeleteBooking(id) {
  return j(await fetch(`${BASE}/api/admin/bookings/${id}`, {
    method: "DELETE",
    credentials: "include"
  }));
}

export async function adminSyncGoogleSheet() {
  return j(await fetch(`${BASE}/api/admin/sync-google-sheet`, {
    method: "POST",
    credentials: "include"
  }));
}

export async function fetchAdminStats(from, to) {
  let qs = "";
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from) && to && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to) {
    qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }
  return j(await fetch(`${BASE}/api/admin/stats${qs}`, { credentials: "include" }));
}

export async function fetchAdminStatsWeekDetail(weekStart) {
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    throw new Error("INVALID_RANGE");
  }
  return j(await fetch(`${BASE}/api/admin/stats/week-detail?weekStart=${encodeURIComponent(weekStart)}`, { credentials: "include" }));
}
