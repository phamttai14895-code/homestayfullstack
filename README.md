# Homestay Booking App

Ứng dụng đặt phòng homestay: xem phòng, đặt phòng qua đêm/theo giờ, thanh toán SePay hoặc tiền mặt, tra cứu đơn, đánh giá, và trang quản trị (phòng, đơn, thống kê, đồng bộ Google Sheet).

## Công nghệ

- **Frontend:** React 18, Vite 5, React Router 6
- **Backend:** Express 4, SQLite (better-sqlite3)
- **Auth:** Google OAuth 2.0 (Passport), session cookie
- **Thanh toán:** SePay (QR + webhook xác nhận chuyển khoản)

## Cấu trúc thư mục

```
homestay-app-5/
├── frontend/                 # Ứng dụng React
│   ├── src/
│   │   ├── components/      # Topbar, Lightbox, FloatingContact, AmenityIcons...
│   │   ├── context/         # I18n, Theme, Currency
│   │   ├── locales/         # vi.json, en.json
│   │   ├── pages/           # Home, RoomDetail, Booking, MyBookings, Admin...
│   │   ├── api.js           # Client gọi API (credentials: include)
│   │   └── styles.css
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── server.js            # Entry: Express, session, mount routes
│   ├── config.js            # PORT, FRONTEND_ORIGIN, SESSION_SECRET, deposit %...
│   ├── db.js                # SQLite, migrateNewColumns, parseJsonArray, decorateRoom
│   ├── middleware.js        # requireLogin, requireAdmin, isAdminEmail
│   ├── helpers.js           # parseISODate, isAfterCheckout, cleanupExpiredSepay...
│   ├── routes/              # public, user, bookings, payment (auth & admin vẫn trong server.js)
│   ├── services/            # sepay.js, email.js, googleSheet.js
│   ├── uploads/             # Ảnh phòng & ảnh đánh giá (tạo tự động)
│   ├── .env.example
│   └── package.json
├── package.json             # Monorepo: dev:frontend, dev:backend, lint
└── README.md
```

## Chạy dự án

### Yêu cầu

- Node.js 18+
- npm hoặc yarn

### 1. Cài đặt

```bash
# Cài dependency root (lint)
npm install

# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && npm install && cd ..
```

### 2. Cấu hình môi trường

**Backend** — copy và sửa `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Các biến quan trọng:

- `PORT` — cổng API (mặc định 4000)
- `FRONTEND_ORIGIN` — URL frontend (vd: http://localhost:5173)
- `SESSION_SECRET` — chuỗi bí mật session (bắt buộc đổi trong production)
- `DB_FILE` — file SQLite (vd: data.sqlite)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — Google OAuth
- `ADMIN_EMAILS` — danh sách email admin (phân cách dấu phẩy)
- `SMTP_*` — gửi email xác nhận đặt phòng
- `SEPAY_*` — bank, webhook SePay

**Frontend** — copy và sửa `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

- `VITE_API_URL` — URL backend (vd: http://localhost:4000)
- `VITE_CONTACT_PHONE`, `VITE_ZALO_LINK`, `VITE_MESSENGER_LINK` — liên hệ / Zalo OA
- `VITE_VND_TO_USD` — (tùy chọn) tỷ giá VND/USD để hiển thị giá

Đầy đủ biến: xem `backend/.env.example` và `frontend/.env.example`.

### 3. Chạy development

Mở **hai terminal**:

```bash
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Frontend
npm run dev:frontend
```

- Backend: http://localhost:4000  
- Frontend: http://localhost:5173  

### 4. Lint

```bash
npm run lint
npm run lint:fix
```

### 5. Test

- **Frontend:** Unit test (Vitest) — chạy trong thư mục `frontend`:
  ```bash
  cd frontend && npm run test
  ```
  Test hiện có: `src/utils/parse.test.js` (safeArr, parseAmenities, parseUrls).
- **Integration:** Test API/booking/payment webhook có thể thêm sau (vd. dùng fetch + backend khởi động tạm).

## API chính

| Nhóm        | Ví dụ route                         | Mô tả                    |
|------------|--------------------------------------|---------------------------|
| Công khai  | `GET /api/rooms`, `/api/rooms/:id/reviews` | Danh sách phòng, đánh giá |
| Công khai  | `GET /api/availability/:roomId`      | Lịch bận (blocks, hourly_slots) |
| Công khai  | `GET /api/booking-search`           | Tra cứu đơn (code / id / phone+email) |
| Auth       | `GET /auth/google`, `/auth/google/callback`, `POST /auth/logout` | Đăng nhập Google |
| User       | `GET /api/me`, `GET /api/my-bookings`, `POST /api/reviews` | Cần đăng nhập |
| Booking    | `POST /api/bookings`, `GET /api/bookings/:id/payment` | Tạo đơn, thông tin thanh toán |
| Payment    | `POST /api/sepay/webhook/:secret`   | Webhook SePay             |
| Admin      | `GET/POST/PUT/DELETE /api/admin/rooms`, `/api/admin/bookings`, `/api/admin/stats`... | Quản trị |

## Tính năng

- **Khách:** Xem phòng, lọc qua đêm/theo giờ, tìm theo tên/địa điểm, đặt phòng (SePay cọc/toàn bộ hoặc tiền mặt), tra cứu đơn, đánh giá (có ảnh) sau check-out, hướng dẫn check-in (popup + Zalo OA).
- **Admin:** CRUD phòng, giá theo ngày, ảnh; quản lý đơn (trạng thái, thanh toán); trả lời/xóa đánh giá; thống kê doanh thu & occupancy; đồng bộ 2 chiều Google Sheet (tùy cấu hình).

## Ảnh mặc định khi share (Open Graph)

Trang web dùng thẻ `og:image` để hiển thị ảnh khi share link lên mạng xã hội. Mặc định `index.html` tham chiếu `/og-default.png`. Để có ảnh đẹp khi share:

- Đặt file **`frontend/public/og-default.png`** (khuyến nghị kích thước **1200×630 px**).
- Nếu không đặt file, một số nền tảng có thể không hiển thị ảnh hoặc dùng ảnh mặc định của họ.

## Ghi chú

- Backend dùng **ES modules** (`"type": "module"`).
- Session cookie: `httpOnly`, `sameSite: lax`; khi chạy production (`NODE_ENV=production`) cookie dùng `secure: true` (HTTPS).
- Đổi `SESSION_SECRET` và không dùng secret mặc định khi chạy production.
- **Rate limit:** Đăng nhập Google tối đa 20 lần / 15 phút / IP; tạo đơn đặt phòng (POST `/api/bookings`) tối đa 30 lần / 15 phút / IP. Khi vượt trả về `429` với `error: "TOO_MANY_REQUESTS"`.
- Chi tiết biến môi trường xem `backend/.env.example` và `frontend/.env.example`.
- **CSRF:** Hiện tại SPA và API dùng cùng domain (hoặc trusted `FRONTEND_ORIGIN`), cookie `sameSite: lax` giảm rủi ro CSRF. **Nếu sau này mở API cho nhiều domain hoặc cho phép form POST từ domain khác**, cần thêm CSRF token (vd. double-submit cookie hoặc header `X-CSRF-Token`) và kiểm tra `Origin`/`Referer` trên các request state-changing.

Nếu muốn có ảnh khi share link, thêm file frontend/public/og-default.png (nên dùng 1200×630 px).