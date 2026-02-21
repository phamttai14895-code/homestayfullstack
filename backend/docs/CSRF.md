# CSRF (Cross-Site Request Forgery)

## Hiện trạng

- Ứng dụng dùng **session cookie** (httpOnly, sameSite: lax) và **CORS** với `FRONTEND_ORIGIN` cố định.
- Frontend (React) và Backend (Express) chạy cùng domain hoặc frontend gọi API từ origin được phép.
- Với mô hình này, **sameSite: lax** giúp giảm rủi ro CSRF vì cookie không gửi kèm request cross-site từ form POST hoặc link từ site khác (trong nhiều trường hợp).

## Khi nào cần thêm CSRF

- **Mở API cho nhiều domain** (nhiều frontend, mobile app, bên thứ ba).
- **Cho phép form POST từ domain khác** (embed form, redirect từ site khác).
- **Yêu cầu bảo mật cao** (ngân hàng, admin nhạy cảm).

## Hướng triển khai (khi cần)

1. **CSRF token:** Tạo token khi session được tạo, gửi cho client (qua meta tag hoặc API), client gửi lại qua header `X-CSRF-Token` hoặc body. Backend so sánh token với session.
2. **Double-submit cookie:** Set cookie (không httpOnly) chứa token; client đọc và gửi cùng giá trị trong header. Backend so sánh cookie và header.
3. **Kiểm tra Origin / Referer:** Middleware chỉ chấp nhận request có `Origin` hoặc `Referer` nằm trong danh sách domain tin cậy (bổ trợ, không thay thế token).

Tài liệu tham khảo: [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
