# Hướng dẫn Deploy Homestay App lên Cotabo VPS

## Mục lục

1. [Chuẩn bị VPS](#bước-1-chuẩn-bị-cotabo-vps)
2. [SSH và cập nhật hệ thống](#bước-2-kết-nối-ssh-và-cập-nhật-hệ-thống)
3. [Cài Node.js 20](#bước-3-cài-đặt-nodejs-20-lts)
4. [Cài Nginx và PM2](#bước-4-cài-đặt-nginx-và-pm2)
5. [Clone project](#bước-5-cài-đặt-git-và-clone-project)
6. [Cài dependencies và Build](#bước-6-cài-đặt-dependencies-và-build)
7. [Cấu hình .env](#bước-7-cấu-hình-môi-trường-env)
8. [Chạy Backend với PM2](#bước-8-chạy-backend-với-pm2)
9. [Cấu hình Nginx](#bước-9-cấu-hình-nginx)
10. [Cài SSL HTTPS](#bước-10-cài-ssl-https-với-lets-encrypt)
11. [Firewall](#bước-11-cấu-hình-firewall-ufw)
12. [Bảng xử lý lỗi đầy đủ](#phần-2-bảng-xử-lý-lỗi-đầy-đủ)

---

## Tổng quan

Ứng dụng gồm:
- **Frontend:** React + Vite (build ra file tĩnh trong `frontend/dist/`)
- **Backend:** Node.js + Express (port 4000)
- **Database:** SQLite (file `homestay.db`)

**Lưu ý đường dẫn:** Trong hướng dẫn dùng `/var/www/homestay-app-full`. Nếu bạn clone với tên khác (vd: `homestayfullstack`), thay thế tất cả đường dẫn cho đúng.

---

# PHẦN 1: CÀI ĐẶT VPS TỪ ĐẦU

---

## Bước 1: Chuẩn bị Cotabo VPS

### 1.1 Đăng ký VPS

1. Truy cập [Cotabo](https://www.cotabo.de/)
2. Chọn gói VPS (VPS S hoặc M là đủ)
3. Chọn **Ubuntu 22.04 LTS**
4. Chọn region (Frankfurt, Nuremberg...)
5. Thanh toán và chờ VPS được tạo

### 1.2 Lấy thông tin đăng nhập

- **IP Address:** ví dụ `123.45.67.89`
- **Username:** thường là `root`
- **Password:** gửi qua email hoặc trong Control Panel

### 1.3 Trỏ domain về VPS

1. Vào nhà cung cấp domain (Cloudflare, Namecheap, GoDaddy...)
2. Thêm **A Record**:
   - **Name:** `@` (hoặc `www` nếu muốn www riêng)
   - **Value:** IP của VPS
   - **TTL:** 300 hoặc Auto

3. Đợi DNS cập nhật (5–30 phút). Kiểm tra:
   ```bash
   ping yourdomain.com
   ```

---

## Bước 2: Kết nối SSH và cập nhật hệ thống

```powershell
ssh root@YOUR_VPS_IP
```

Lần đầu hỏi → gõ `yes`. Nhập password khi được hỏi.

```bash
apt update
apt upgrade -y
```

---

## Bước 3: Cài đặt Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node -v
npm -v
```

---

## Bước 4: Cài đặt Nginx và PM2

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx

npm install -g pm2
pm2 -v
```

---

## Bước 5: Cài đặt Git và Clone project

```bash
apt install -y git
cd /var/www
git clone https://github.com/phamttai14895-code/homestayfullstack.git
cd homestayfullstack
```

**Thay `YOUR_USERNAME`** bằng username GitHub. Nếu repo của bạn có tên khác (vd: `homestayfullstack`), sau khi clone sẽ có thư mục tương ứng — dùng đúng tên đó và thay thế `homestay-app-full` trong toàn bộ đường dẫn phía dưới.

---

## Bước 6: Cài đặt dependencies và Build

### 6.1 Root

```bash
cd /var/www/homestayfullstack
npm install
```

### 6.2 Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

**Nếu lỗi "Missing script: build":** Chạy `npx vite build` thay vì `npm run build`.

Kiểm tra: `ls -la frontend/dist` phải thấy `index.html` và `assets/`.

### 6.3 Backend

```bash
cd backend
npm install
cd ..
```

**Lỗi better-sqlite3:** Cài build tools rồi chạy lại `npm install`:
```bash
apt install -y build-essential python3
cd backend && npm install && cd ..
```

---

## Bước 7: Cấu hình môi trường (.env)

### 7.1 Backend (`backend/.env`)

```bash
cd /var/www/homestayfullstack/backend
cp .env.example .env
nano .env
```

**Tạo SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy kết quả vào `SESSION_SECRET=` trong `.env`.

**Cập nhật các biến bắt buộc cho production:**

| Biến | Ví dụ production |
|------|------------------|
| `PORT` | 4000 |
| `FRONTEND_ORIGIN` | https://yourdomain.com |
| `BACKEND_ORIGIN` | https://yourdomain.com (nếu Nginx proxy toàn bộ) hoặc https://yourdomain.com/api (nếu proxy /api → backend). Dùng cho link xác nhận email đăng ký. |
| `SESSION_SECRET` | (kết quả openssl rand -hex 32) |
| `GOOGLE_CALLBACK_URL` | https://yourdomain.com/auth/google/callback |
| `FACEBOOK_CALLBACK_URL` | https://yourdomain.com/auth/facebook/callback |
| `ADMIN_DASHBOARD_URL` | https://yourdomain.com/admin |
| `SEPAY_API_KEY` | API Key từ SePay (webhook gửi header `Authorization: Apikey API_KEY`) |

**SePay webhook:** SePay không dùng webhook secret trong URL. Xác thực bằng API Key qua header `Authorization: Apikey API_KEY`. Webhook URL: `https://yourdomain.com/api/sepay/webhook`. Trong SePay Dashboard → Webhooks → chọn loại xác thực **API Key**.  
**Quan trọng:** Nếu bật "Ignore if transaction content does not contain payment code", cần cấu hình **Company → General Settings → Payment Code Structure** để SePay nhận dạng mã đơn (vd: `HS-123-NVH-XXXXXX`). App dùng nội dung chuyển khoản để tìm đơn (order code = ORDER_PREFIX-id-lookup_code). Khách chuyển khoản phải ghi đúng mã đơn vào nội dung.

Lưu: `Ctrl+O` → Enter → `Ctrl+X`

**Cập nhật OAuth trên Google Cloud Console:** Thêm `https://yourdomain.com/auth/google/callback` vào **Authorized redirect URIs**.

**Cập nhật OAuth trên Facebook Developer:** Thêm `https://yourdomain.com/auth/facebook/callback` vào **Valid OAuth Redirect URIs**.

### 7.2 Frontend (`frontend/.env`)

**Quan trọng:** Biến Vite nhúng lúc build. Phải set trước khi `npm run build`.

```bash
cd /var/www/homestayfullstack/frontend
cp .env.example .env
nano .env
```

```env
VITE_API_URL=https://yourdomain.com
VITE_CONTACT_PHONE=0900000000
VITE_ZALO_LINK=https://zalo.me/0900000000
VITE_MESSENGER_LINK=https://m.me/yourpage
VITE_VND_TO_USD=25000
```

**Lưu ý:** `VITE_API_URL` phải dùng **https** (không http) khi site chạy HTTPS, tránh lỗi Mixed Content.

Sau khi sửa:
```bash
npm run build
cd ..
```

---

## Bước 8: Chạy Backend với PM2

```bash
cd /var/www/homestayfullstack/backend
NODE_ENV=production pm2 start server.js --name homestay-api
pm2 save
pm2 startup
```

Với root, `pm2 startup` có thể tự chạy; nếu in ra lệnh thì copy và chạy theo.

Kiểm tra:
```bash
pm2 status
curl http://127.0.0.1:4000/api/rooms
```

---

## Bước 9: Cấu hình Nginx

### 9.1 Tạo file cấu hình

```bash
rm -f /etc/nginx/sites-enabled/default
nano /etc/nginx/sites-available/homestay
```

**Chỉ dán nội dung bên trong khối dưới đây. Không copy `\`\`\`nginx` hay `\`\`\`` (đây là cú pháp markdown, sẽ gây lỗi Nginx).**

```nginx
server {
    listen 80;
    server_name abcjqk.space www.abcjqk.space;
    client_max_body_size 10M;
    root /var/www/homestayfullstack/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }
}
```

**Thay `yourdomain.com` và `root`** theo domain và tên thư mục thực tế (vd: `homestayfullstack`).

### 9.2 Kích hoạt và reload

```bash
ln -sf /etc/nginx/sites-available/homestay /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Nếu `ln` báo "File exists", bỏ qua — symlink đã có sẵn.

---

## Bước 10: Cài SSL (HTTPS) với Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d abcjqk.space -d www.abcjqk.space
```

Làm theo hướng dẫn. Certbot sẽ tự cập nhật cấu hình Nginx cho HTTPS.

---

## Bước 11: Cấu hình Firewall (UFW)

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

---

## Cập nhật code sau này

```bash
cd /var/www/homestayfullstack
git pull origin main

cd frontend && npm install && npm run build && cd ..
cd backend && npm install && cd ..
pm2 restart homestay-api
```

---

# PHẦN 2: BẢNG XỬ LÝ LỖI ĐẦY ĐỦ

---

## Lỗi thường gặp và cách xử lý

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| **Cloudflare 521 Web server is down** | Cloudflare không kết nối được origin | 1) `systemctl status nginx` → nếu inactive thì `systemctl start nginx`<br>2) `ufw allow 80 && ufw allow 443 && ufw reload`<br>3) Cloudflare → SSL/TLS → chọn **Flexible** (nếu chưa cài SSL trên VPS)<br>4) DNS A record trỏ đúng IP VPS |
| **500 Internal Server Error** | `frontend/dist` thiếu hoặc sai quyền | 1) `ls -la /var/www/.../frontend/dist` → nếu trống thì `cd frontend && npm run build`<br>2) `chown -R www-data:www-data /var/www/...` |
| **502 Bad Gateway** | Backend không chạy hoặc crash | 1) `pm2 status` → nếu offline: `pm2 restart homestay-api`<br>2) `pm2 logs homestay-api` xem lỗi |
| **Mixed Content (HTTP blocked)** | Frontend gọi API qua `http` trong khi trang là `https` | Sửa `frontend/.env`: `VITE_API_URL=https://yourdomain.com` (phải **https**), rồi `npm run build` lại |
| **Google redirect_uri_mismatch (400)** | Callback URL chưa khai báo trong Google | Google Cloud Console → Credentials → OAuth client → Thêm **Authorized redirect URIs**: `https://yourdomain.com/auth/google/callback` |
| **Facebook redirect_uri_mismatch** | Callback URL chưa khai báo trong Facebook | Facebook Developer → App → Facebook Login → Thêm **Valid OAuth Redirect URIs**: `https://yourdomain.com/auth/facebook/callback` |
| **Đăng nhập OAuth xong nhưng không thấy đăng nhập** | Session cookie không được set | Code đã sửa: `trust proxy`, `sameSite: none` (production), `req.session.save()` trước redirect. Đảm bảo:<br>1) `backend/.env`: `FRONTEND_ORIGIN=https://yourdomain.com`<br>2) PM2 chạy với `NODE_ENV=production`<br>3) DevTools → Application → Cookies: kiểm tra có `connect.sid` sau khi đăng nhập |
| **CORS / 401** | `FRONTEND_ORIGIN` sai | Sửa `backend/.env`: `FRONTEND_ORIGIN=https://yourdomain.com` (không có `/` cuối). Restart: `pm2 restart homestay-api` |
| **nginx: unknown directive "nginx"** | Copy cả `\`\`\`nginx` từ markdown vào config | Mở file Nginx, xóa dòng `nginx` thừa. Chỉ giữ nội dung `server { ... }`. Chạy `nginx -t` rồi `systemctl reload nginx` |
| **ln: failed to create symbolic link: File exists** | Symlink đã tồn tại | Bỏ qua bước tạo symlink, hoặc dùng `ln -sf` để ghi đè |
| **npm error Missing script: "build"** | `package.json` frontend chưa có script build | Chạy `npx vite build` thay vì `npm run build`. Hoặc thêm `"build": "vite build"` vào `frontend/package.json` |
| **Can't reach this page / site không mở** | VPS/Nginx/Backend down | 1) SSH vào VPS: `ssh root@IP`<br>2) `systemctl status nginx` → start nếu cần<br>3) `pm2 status` → restart nếu cần<br>4) `curl http://127.0.0.1` và `curl http://127.0.0.1:4000/api/rooms`<br>5) `ufw status` → đảm bảo 80, 443 mở |
| **SQLite permission denied** | Thư mục backend không có quyền ghi | `chown -R www-data:www-data /var/www/...` hoặc `chmod 755 backend` |
| **npm install better-sqlite3 fails** | Thiếu build tools | `apt install -y build-essential python3` rồi `npm install` trong backend |
| **Trang trắng / 404 khi reload SPA** | Nginx thiếu fallback SPA | Kiểm tra `location /` có `try_files $uri $uri/ /index.html;` |
| **pm2 startup không in lệnh sudo** | Chạy với root | Với root, PM2 thường tự cấu hình. Chạy `pm2 save` để lưu danh sách process. |
| **SePay: có tiền vào nhưng không tự động xác nhận** | Webhook không gọi / sai nội dung / 401 | 1) SePay Dashboard → Webhooks: URL đúng `https://yourdomain.com/api/sepay/webhook`, Auth = API Key, API Key trùng `SEPAY_API_KEY` trong .env<br>2) SePay → Company → Payment Code Structure: cấu hình nhận dạng mã đơn (vd. HS-xxx-NVH-xxxxxx) hoặc tắt "Ignore if content does not contain payment code"<br>3) Khách chuyển khoản phải ghi **đúng mã đơn** (hiển thị ở bước thanh toán) vào nội dung CK<br>4) Xem log: `pm2 logs homestay-api` — có dòng `[SePay webhook] received` = webhook có gọi; `Không tìm thấy booking` = nội dung không khớp mã đơn |
| **Link xác nhận email đăng ký báo "Link không hợp lệ"** | Link trong email trỏ thẳng tới frontend, backend không xử lý token | Link xác nhận phải trỏ tới **backend** để xác thực token rồi redirect về frontend. Trong `backend/.env` thêm/sửa **BACKEND_ORIGIN**:<br>• Cùng domain, Nginx proxy `/api` → backend: `BACKEND_ORIGIN=https://yourdomain.com/api`<br>• Backend chạy riêng subdomain: `BACKEND_ORIGIN=https://api.yourdomain.com`<br>Sau đó restart: `pm2 restart homestay-api`. Đăng ký lại để nhận email mới với link đúng. |
| **Có đơn đặt phòng nhưng admin không nhận email báo** | Chưa cấu hình SMTP hoặc ADMIN_NOTIFY_EMAILS | 1) Trong `backend/.env` đặt **SMTP_HOST**, **SMTP_USER**, **SMTP_PASS** (vd. Gmail App Password, SendGrid, Mailgun).<br>2) Đặt **ADMIN_NOTIFY_EMAILS** = email admin (nhiều email cách nhau dấu phẩy), ví dụ: `ADMIN_NOTIFY_EMAILS=admin@yourdomain.com`<br>3) Restart: `pm2 restart homestay-api`<br>4) Xem log: `pm2 logs homestay-api` — nếu thấy `[Email] notifyAdminNewBooking: bỏ qua vì chưa cấu hình SMTP` hoặc `chưa có ADMIN_NOTIFY_EMAILS` thì sửa .env tương ứng. Kiểm tra hộp thư rác. |
| **Đã cấu hình SMTP nhưng vẫn không thấy email** | Sai mật khẩu / port / bị chặn / vào spam | 1) **Xem log khi có đơn hoặc đăng ký:** `pm2 logs homestay-api` — nếu gửi thành công sẽ thấy `[Email] ... sent → email@...`; nếu lỗi sẽ thấy `[Email] ... failed → ...` kèm **code** và **response** (ví dụ Invalid login, self-signed certificate).<br>2) **Gmail:** dùng **App Password** (không dùng mật khẩu đăng nhập). Bật 2 bước xác minh → Tài khoản Google → Bảo mật → Mật khẩu ứng dụng. `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=your@gmail.com`, `SMTP_PASS=app_password_16_chars`.<br>3) **Port:** 465 (SSL) hoặc 587 (TLS). Nếu 587: `SMTP_PORT=587`, `SMTP_SECURE=false` (nodemailer dùng STARTTLS).<br>4) **VPS chặn outbound 465/587:** mở port: `ufw allow out 465` và/hoặc `587`; hoặc dùng SMTP relay khác.<br>5) Kiểm tra **hộp thư rác** và whitelist địa chỉ gửi (SMTP_FROM / SMTP_USER). |
| **Google Sheet không đồng bộ 2 chiều** | Thiếu cấu hình / quyền / tab / polling | 1) **Web→Sheet (ghi đơn lên Sheet):** Mỗi khi tạo/cập nhật/xóa đơn, backend gọi push. Xem log: `pm2 logs homestay-api` — thấy `[GoogleSheets] push OK → ...` = thành công; `push failed` = lỗi (thường do tab "Web" không tồn tại hoặc Sheet chưa share với Service Account).<br>2) **Sheet→Web (đọc Sheet vào app):** Cần **GOOGLE_SHEETS_POLL_MINUTES** > 0 để tự động mỗi N phút; nếu = 0 thì chỉ đồng bộ khi admin bấm «Đồng bộ» trong trang Admin.<br>3) **Cấu hình:** Đặt `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_CREDENTIALS_PATH=credentials/google-sheets.json` (file đặt trong `backend/credentials/`). Chia sẻ Google Sheet với email trong file JSON (client_email) quyền **Chỉnh sửa**. Tạo tab tên **Web** trong Sheet (hoặc đặt `GOOGLE_SHEETS_WEB_RANGE=Sheet1!A201:F500`).<br>4) Restart: `pm2 restart homestay-api`. |

### Điền Google Sheet để chặn ngày trên web (lịch đặt phòng)

- Dùng **tab được đọc bởi app** (mặc định là **Sheet1**, theo `GOOGLE_SHEETS_RANGE=Sheet1!A2:F500`). **Không** điền vào tab **Web** (tab Web do app ghi đơn từ web lên, sẽ bị ghi đè).
- **Cột:** A = Phòng (tên phòng hoặc ID), B = Check-in, C = Check-out, D = status (`pending` hoặc `confirmed`), E, F = giờ bắt đầu/kết thúc (nếu đặt theo giờ).
- **Ngày:** Có thể nhập **2026-04-29** hoặc **29-04-2026** (hoặc 29/04/2026). Sau khi đồng bộ, các ngày này sẽ bị chặn trên lịch đặt phòng web.
- **Đồng bộ:** Đặt `GOOGLE_SHEETS_POLL_MINUTES=5` (hoặc số phút bất kỳ > 0) để app tự đọc Sheet mỗi N phút; hoặc vào **Admin → Đồng bộ Google Sheet** và bấm đồng bộ thủ công. Sau khi sync, lịch trên web sẽ hiển thị các ngày đã điền trong Sheet là đã đặt/chặn.

---

## Checklist deploy (soát lần cuối)

- [ ] VPS Ubuntu 22.04, Node 20, Nginx, PM2
- [ ] Clone repo, `npm install` frontend + backend (đường dẫn đúng tên thư mục sau clone)
- [ ] `frontend/.env`: `VITE_API_URL=https://yourdomain.com` (https), `VITE_CONTACT_PHONE`, `VITE_ZALO_LINK`, `VITE_MESSENGER_LINK`
- [ ] `backend/.env`: `FRONTEND_ORIGIN`, `BACKEND_ORIGIN` (link xác nhận email), `SESSION_SECRET`, OAuth callback URLs, `SEPAY_API_KEY` (nếu dùng SePay)
- [ ] Build frontend: `cd frontend && npm run build` (hoặc `npx vite build`)
- [ ] PM2: `NODE_ENV=production pm2 start server.js --name homestay-api`; `pm2 save`; `pm2 startup`
- [ ] Nginx: serve `frontend/dist`, proxy `/api`, `/auth`, `/uploads`; **X-Forwarded-Proto** dùng `$http_x_forwarded_proto` (khi dùng Cloudflare)
- [ ] Nginx: `client_max_body_size 10M` (upload ảnh admin)
- [ ] SSL (certbot) hoặc Cloudflare Flexible
- [ ] UFW mở 22, 80, 443
- [ ] Google/Facebook OAuth: thêm callback URL production
- [ ] SePay: Webhook URL `https://yourdomain.com/api/sepay/webhook`, Auth = API Key
- [ ] Test đăng nhập → cookie `connect.sid`; test SePay webhook → đơn tự cập nhật

---

## Tham khảo

- [Cotabo](https://www.cotabo.de/en/support/)
- [PM2](https://pm2.keymetrics.io/)
- [Certbot](https://certbot.eff.org/)
- [Cloudflare SSL modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)
