# Đánh giá code — Homestay App

*Đánh giá lại toàn bộ codebase (frontend + backend) sau các bổ sung SEO, UserContext, lazy load, ảnh, focus trap.*

---

## 1. Tổng quan kiến trúc

| Khía cạnh | Đánh giá |
|-----------|----------|
| **Cấu trúc** | Monorepo rõ ràng: `frontend/` (Vite + React), `backend/` (Express + SQLite). Tách routes, services, middleware hợp lý. |
| **Frontend** | React 18, React Router, context (I18n, Theme, Currency, **User**). Trang lazy-load qua `React.lazy`, một `Suspense` chung. |
| **Backend** | Express, session + Passport Google OAuth, better-sqlite3, file upload (multer), webhook SePay, email, Google Sheet. |
| **Luồng dữ liệu** | User: một lần `fetchMe` trong `UserProvider`, cache `me`, expose `refresh`; các trang dùng `useUser()` thay vì gọi API trùng lặp. |

**Kết luận:** Kiến trúc phù hợp với quy mô homestay/booking, dễ mở rộng (thêm route, thêm context).

---

## 2. Bảo mật

| Điểm | Trạng thái | Ghi chú |
|------|------------|--------|
| **Session** | ✅ | `httpOnly`, `sameSite: "lax"`. Có cảnh báo khi dùng `SESSION_SECRET` mặc định. |
| **Cookie secure** | ⚠️ | Chưa set `secure: true` khi chạy HTTPS (production). Nên: `cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }`. |
| **Admin** | ✅ | Backend: `requireAdmin` (401/403); frontend: `RequireAdmin` redirect. Admin theo `ADMIN_EMAILS` (env). |
| **API bảo vệ** | ✅ | `requireLogin` / `requireAdmin` trên route nhạy cảm; GET `/bookings/:id/payment` kiểm tra `user_id` hoặc admin. |
| **Webhook SePay** | ✅ | So khớp `req.params.secret` với `SEPAY_WEBHOOK_SECRET`. |
| **Upload ảnh** | ✅ | `onlyUploads()` chỉ chấp nhận URL bắt đầu `/uploads/`, độ dài < 500; không path traversal. |
| **XSS (email)** | ✅ | `escapeHtml()` dùng trong template email. |
| **SQL** | ✅ | Tham số hóa (prepared statements), không nối chuỗi SQL từ input. |
| **CORS** | ✅ | `origin: FRONTEND` (env), `credentials: true`. |

**Đề xuất:** Thêm `secure` cho cookie khi production; có thể thêm rate limit cho `/api/bookings` (POST) và `/auth/google` nếu triển khai public.

---

## 3. Hiệu năng & UX

| Điểm | Trạng thái |
|------|------------|
| **Lazy load trang** | ✅ Tất cả page dùng `React.lazy`, một fallback "Đang tải…". |
| **Cache user** | ✅ `UserContext` gọi `fetchMe` một lần, tránh gọi trùng ở Topbar, RequireAdmin, MyBookings, v.v. |
| **Ảnh LCP** | ✅ Home: ảnh đầu `fetchpriority="high"`, `loading="eager"`; RoomDetail gallery tương tự; có `width`/`height` giảm CLS. |
| **MyBookings nháy** | ✅ Đã sửa: dependency `useEffect` dùng `me?.id` thay vì `me` để tránh re-run khi `refresh()` cập nhật object. |

---

## 4. SEO & meta

| Điểm | Trạng thái |
|------|------------|
| **Canonical** | ✅ `seo.setCanonical(path)` theo từng trang, RoomDetail truyền `canonicalPath: /room/:id`. |
| **OG** | ✅ `setOgMeta(title, description, image)`; RoomDetail truyền ảnh đại diện; index.html có og:image mặc định. |
| **JSON-LD** | ✅ Home: Organization + WebSite; RoomDetail: Accommodation (name, description, image, address, url). |
| **Sitemap / robots** | ✅ `public/sitemap.xml`, `public/robots.txt`. |
| **usePageTitle** | ✅ Cập nhật title, meta description, canonical, OG; dùng `useLocation()` trong Router. |

---

## 5. Khả năng truy cập (a11y)

| Điểm | Trạng thái |
|------|------------|
| **Skip link** | ✅ `<a href="#main-content" class="skip-link">`. |
| **Lightbox** | ✅ Focus trap: lưu focus, focus nút đóng khi mở; Tab/Shift+Tab giữ trong modal; restore focus khi đóng. |
| **Semantic** | ✅ `role="main"`, `aria-label`, `aria-modal`, nút có `aria-label`. |

---

## 6. Chất lượng code

| Điểm | Ghi chú |
|------|--------|
| **Xử lý lỗi API** | Frontend: `parseResponse` ném `Error(message)`; backend trả về `error` hoặc `message` nhất quán. |
| **i18n** | Locales `vi`/`en`, `useI18n()`; key rõ ràng (common.*, home.*, room.*, ...). |
| **Validation backend** | Booking: kiểm tra ngày, giờ, trùng lịch, room tồn tại; admin routes validate id, body. |
| **Helpers** | `onlyUploads`, `parseISODate`, `timeRangesOverlap`, `escapeHtml` tái sử dụng tốt. |

---

## 7. Điểm cần lưu ý / cải thiện

1. **Cookie secure (production)**  
   Trong `server.js`, session cookie nên bật `secure: true` khi chạy HTTPS (ví dụ `NODE_ENV === "production"` hoặc biến env riêng).

2. **Rate limiting**  
   Chưa có rate limit cho API. Nên cân nhắc thêm (vd. express-rate-limit) cho POST `/api/bookings`, `/auth/google`, và webhook nếu endpoint public.

3. **Webhook SePay — trùng giao dịch**  
   Đã có `payment_events` với `provider_txn_id` để tránh insert trùng; duplicate request có thể return 200 và không cập nhật lại booking (chấp nhận được). Có thể log khi không tìm thấy booking từ description để debug.

4. **Frontend — trang Payment**  
   Route `/payment/:id` không bắt buộc đăng nhập; API `GET /api/bookings/:id/payment` có `requireLogin`. Nếu user chưa đăng nhập vào trang Payment sẽ nhận 401; nên giữ hoặc thêm redirect về login/booking-status tùy nghiệp vụ.

5. **Ảnh og-default.png**  
   `index.html` tham chiếu `/og-default.png`; cần đặt file trong `frontend/public/` nếu muốn ảnh mặc định khi share link.

6. **AdminDashboard**  
   File lớn (~1100 dòng); có thể tách thành component con (RoomForm, BookingTable, ReviewRow, …) để dễ bảo trì.

---

## 8. Kết luận

- **Điểm mạnh:** Kiến trúc rõ, bảo mật cơ bản tốt (session, admin, webhook, upload, SQL, XSS email), SEO và meta đã được bổ sung đầy đủ, lazy load + UserContext cải thiện hiệu năng và trải nghiệm, a11y có skip link và focus trap.
- **Nên làm thêm:** Bật `secure` cho cookie khi production, cân nhắc rate limit và (tùy chọn) tách nhỏ AdminDashboard hoặc thêm og-default.png.

Tổng thể codebase **ổn định, phù hợp triển khai** sau khi chỉnh cookie production và (nếu cần) rate limit.
