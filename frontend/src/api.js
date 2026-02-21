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
export async function adminBookings({ q = "", status = "all" } = {}) {
  const qs = new URLSearchParams({ q, status }).toString();
  return j(await fetch(`${BASE}/api/admin/bookings?${qs}`, { credentials: "include" }));
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

export async function fetchAdminStats(month) {
  const qs = month && /^\d{4}-\d{2}$/.test(month) ? `?month=${encodeURIComponent(month)}` : "";
  return j(await fetch(`${BASE}/api/admin/stats${qs}`, { credentials: "include" }));
}
