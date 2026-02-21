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

---

## Tổng quan

Ứng dụng gồm:
- **Frontend:** React + Vite (build ra file tĩnh)
- **Backend:** Node.js + Express (port 4000)
- **Database:** SQLite (file `homestay.db`)

---

# PHẦN 1: CÀI ĐẶT VPS TỪ ĐẦU

---

## Bước 1: Chuẩn bị Cotabo VPS

### 1.1 Đăng ký VPS

1. Truy cập [Cotabo](https://www.cotabo.de/)
2. Chọn gói VPS (VPS S hoặc M là đủ cho homestay app)
3. Chọn **Ubuntu 22.04 LTS**
4. Chọn region gần Việt Nam (Frankfurt, Nuremberg...)
5. Thanh toán và chờ VPS được tạo (thường vài phút)

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

   Khi thấy IP trả về đúng là IP VPS thì OK.

---

## Bước 2: Kết nối SSH và cập nhật hệ thống

### 2.1 Kết nối SSH

**Trên Windows (PowerShell hoặc CMD):**

```powershell
ssh root@YOUR_VPS_IP
```

Ví dụ:

```powershell
ssh root@123.45.67.89
```

- Lần đầu hỏi "Are you sure you want to continue?" → gõ `yes` và Enter
- Nhập password khi được hỏi

**Trên Mac/Linux:**

```bash
ssh root@YOUR_VPS_IP
```

### 2.2 Cập nhật hệ thống

Sau khi đăng nhập thành công:

```bash
apt update
```

Kết quả: dòng "Reading package lists..." và danh sách repo.

```bash
apt upgrade -y
```

- `-y` = tự động Yes cho mọi câu hỏi
- Có thể mất 2–5 phút

---

## Bước 3: Cài đặt Node.js 20 LTS

### 3.1 Thêm repository NodeSource

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

Kết quả mong đợi: các dòng "Adding the NodeSource Node.js 20.x repo..." và "Run 'apt-get install nodejs'...".

### 3.2 Cài Node.js

```bash
apt install -y nodejs
```

### 3.3 Kiểm tra

```bash
node -v
```

Kết quả: `v20.x.x` (ví dụ v20.10.0)

```bash
npm -v
```

Kết quả: số version npm (ví dụ 10.x.x)

---

## Bước 4: Cài đặt Nginx và PM2

### 4.1 Cài Nginx

```bash
apt install -y nginx
```

### 4.2 Khởi động Nginx

```bash
systemctl start nginx
systemctl enable nginx
```

Kiểm tra: mở trình duyệt truy cập `http://YOUR_VPS_IP` — thấy trang mặc định của Nginx.

### 4.3 Cài PM2 (Process Manager cho Node.js)

```bash
npm install -g pm2
```

**PM2** dùng để:
- Chạy backend Node.js nền
- Tự khởi động lại khi crash
- Tự chạy lại khi VPS reboot

### 4.4 Kiểm tra PM2

```bash
pm2 -v
```

---

## Bước 5: Cài đặt Git và Clone project

### 5.1 Cài Git (nếu chưa có)

```bash
apt install -y git
git --version
```

### 5.2 Tạo thư mục và clone

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/homestay-app-full.git
cd homestay-app-full
```

**Lưu ý:** Thay `YOUR_USERNAME` bằng username GitHub của bạn.

**Nếu repo private:**

1. Tạo **Deploy token** hoặc **Personal Access Token** trên GitHub
2. Clone dạng: `git clone https://TOKEN@github.com/USER/repo.git`

**Hoặc dùng SSH key:**

```bash
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy nội dung và thêm vào GitHub: Settings → SSH Keys → New SSH key.

Sau đó clone:

```bash
git clone git@github.com:YOUR_USERNAME/homestay-app-full.git
```

### 5.3 Đặt quyền thư mục (tùy chọn)

```bash
chown -R www-data:www-data /var/www/homestay-app-full
```

---

## Bước 6: Cài đặt dependencies và Build

### 6.1 Cài dependency root (dùng cho lint)

```bash
cd /var/www/homestay-app-full
npm install
```

### 6.2 Cài và build Frontend

```bash
cd frontend
npm install
```

Đợi cài xong (1–2 phút), rồi:

```bash
npm run build
```

Kết quả: thấy "built in ... ms" và thư mục `dist/` được tạo.

```bash
ls -la dist
```

Phải thấy `index.html`, thư mục `assets/`.

```bash
cd ..
```

### 6.3 Cài dependency Backend

```bash
cd backend
npm install
cd ..
```

**Lỗi thường gặp với better-sqlite3:**

Nếu báo lỗi khi `npm install` (build native module), cài thêm:

```bash
apt install -y build-essential python3
```

Rồi chạy lại `npm install` trong thư mục backend.

---

## Bước 7: Cấu hình môi trường (.env)

### 7.1 Backend (`backend/.env`)

```bash
cd /var/www/homestay-app-full/backend
cp .env.example .env
nano .env
```

#### Tạo SESSION_SECRET

Mở terminal mới (hoặc tab mới), chạy:

```bash
openssl rand -hex 32
```

Copy kết quả (64 ký tự hex) và dán vào `SESSION_SECRET=` trong file `.env`.

#### Cập nhật các biến quan trọng

| Biến | Giá trị mẫu | Ghi chú |
|------|-------------|---------|
| `PORT` | 4000 | Giữ nguyên |
| `FRONTEND_ORIGIN` | https://yourdomain.com | **Không** thêm dấu `/` cuối |
| `SESSION_SECRET` | (kết quả `openssl rand -hex 32`) | Bắt buộc đổi, **không** dùng mặc định |
| `DB_FILE` | homestay.db | Giữ nguyên |
| `GOOGLE_CALLBACK_URL` | https://yourdomain.com/auth/google/callback | Trùng với domain thật |
| `FACEBOOK_CALLBACK_URL` | https://yourdomain.com/auth/facebook/callback | Trùng với domain thật |
| `ADMIN_DASHBOARD_URL` | https://yourdomain.com/admin | URL trang admin |

#### Cập nhật OAuth trên Google Cloud Console

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Chọn OAuth 2.0 Client ID
3. Thêm **Authorized redirect URIs:** `https://yourdomain.com/auth/google/callback`
4. Lưu

#### Cập nhật OAuth trên Facebook Developer

1. Vào [Facebook Developer](https://developers.facebook.com/) → App → Settings → Basic
2. Thêm domain vào **App Domains**
3. Vào **Facebook Login** → Settings
4. Thêm vào **Valid OAuth Redirect URIs:** `https://yourdomain.com/auth/facebook/callback`
5. Lưu

#### Lưu file .env trong nano

- `Ctrl + O` → Enter (lưu)
- `Ctrl + X` (thoát)

### 7.2 Frontend (`frontend/.env`)

**Quan trọng:** Biến Vite được nhúng lúc build. Phải set `.env` trước khi chạy `npm run build`.

```bash
cd /var/www/homestay-app-full/frontend
cp .env.example .env
nano .env
```

Nội dung mẫu:

```env
VITE_API_URL=https://yourdomain.com
VITE_CONTACT_PHONE=0900000000
VITE_ZALO_LINK=https://zalo.me/0900000000
VITE_MESSENGER_LINK=https://m.me/yourpage
VITE_VND_TO_USD=25000
```

**Lưu ý:** `VITE_API_URL` là **gốc domain** (không có `/api`), frontend tự ghép path.

Lưu và thoát nano, rồi build lại:

```bash
npm run build
cd ..
```

---

## Bước 8: Chạy Backend với PM2

### 8.1 Khởi động backend

```bash
cd /var/www/homestay-app-full/backend
NODE_ENV=production pm2 start server.js --name homestay-api
```

Kết quả mong đợi:

```
[PM2] Starting server.js in fork_mode
[PM2] Process successfully started
```

### 8.2 Lưu cấu hình PM2 (tự chạy khi reboot)

```bash
pm2 save
pm2 startup
```

Lệnh `pm2 startup` sẽ in ra 1 dòng lệnh (có `sudo env PATH=...`). **Copy và chạy đúng dòng đó.**

### 8.3 Kiểm tra

```bash
pm2 status
```

Phải thấy `homestay-api` có status `online`.

```bash
pm2 logs homestay-api
```

Nếu thấy log bình thường (không error) thì backend đang chạy ổn. Nhấn `Ctrl+C` để thoát logs.

### 8.4 Test API local (trên VPS)

```bash
curl http://127.0.0.1:4000/api/rooms
```

Nếu trả về JSON (danh sách phòng hoặc `[]`) là OK.

---

## Bước 9: Cấu hình Nginx

### 9.1 Xóa site mặc định (tùy chọn)

```bash
rm /etc/nginx/sites-enabled/default
```

### 9.2 Tạo file cấu hình mới

```bash
nano /etc/nginx/sites-available/homestay
```

Dán nội dung dưới đây. **Nhớ thay `yourdomain.com` bằng domain thật của bạn:**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/homestay-app-full/frontend/dist;
    index index.html;

    # Frontend SPA - mọi route trả về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy Auth (OAuth callback)
    location /auth/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy uploads (ảnh local nếu không dùng Cloudinary)
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Lưu: `Ctrl+O` → Enter → `Ctrl+X`

### 9.3 Kích hoạt site

```bash
ln -s /etc/nginx/sites-available/homestay /etc/nginx/sites-enabled/
```

### 9.4 Kiểm tra cú pháp Nginx

```bash
nginx -t
```

Phải thấy: `syntax is ok` và `test is successful`.

### 9.5 Reload Nginx

```bash
systemctl reload nginx
```

### 9.6 Test trên trình duyệt

Mở `http://yourdomain.com` (chưa HTTPS). Nếu thấy giao diện Homestay App là OK.

---

## Bước 10: Cài SSL (HTTPS) với Let's Encrypt

### 10.1 Cài Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 10.2 Lấy chứng chỉ SSL

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Làm theo hướng dẫn trên màn hình:**

1. **Email:** Nhập email để nhận thông báo gia hạn
2. **Terms of Service:** Chọn `Y` (Agree)
3. **Share email with EFF:** `N` hoặc `Y` tùy bạn
4. Chờ Certbot cấu phát và cập nhật Nginx (vài giây)

### 10.3 Kiểm tra HTTPS

Mở `https://yourdomain.com` — phải thấy khóa bảo mật (HTTPS) trên trình duyệt.

### 10.4 Gia hạn tự động

Certbot đã setup cron job. Kiểm tra thử:

```bash
certbot renew --dry-run
```

Nếu không báo lỗi thì quá trình gia hạn sẽ chạy tự động khi gần hết hạn.

---

## Bước 11: Cấu hình Firewall (UFW)

### 11.1 Mở các port cần thiết

```bash
ufw allow 22
ufw allow 80
ufw allow 443
```

- **22:** SSH (để bạn vẫn đăng nhập được)
- **80:** HTTP (redirect sang HTTPS)
- **443:** HTTPS

### 11.2 Bật firewall

```bash
ufw enable
```

Khi hỏi "Proceed with operation?": gõ `y` và Enter.

### 11.3 Kiểm tra

```bash
ufw status
```

Phải thấy các rule `22`, `80`, `443` là `ALLOW`.

---

## Checklist tổng kết

- [ ] VPS Ubuntu 22.04, Node 20, Nginx, PM2
- [ ] Clone repo, `npm install` frontend + backend
- [ ] `frontend/.env`: `VITE_API_URL=https://yourdomain.com`
- [ ] `backend/.env`: `FRONTEND_ORIGIN`, `SESSION_SECRET`, OAuth callback URLs
- [ ] Build frontend: `cd frontend && npm run build`
- [ ] PM2 chạy backend: `pm2 start server.js --name homestay-api`
- [ ] Nginx: serve `frontend/dist`, proxy `/api`, `/auth`, `/uploads` tới port 4000
- [ ] SSL với certbot
- [ ] UFW mở 22, 80, 443

---

## Cập nhật code sau này

```bash
cd /var/www/homestay-app-full
git pull

# Frontend
cd frontend && npm install && npm run build && cd ..

# Backend
cd backend && npm install && cd ..
pm2 restart homestay-api
```

---

# PHẦN 2: XỬ LÝ LỖI VÀ BẢO TRÌ

---

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| **502 Bad Gateway** | Backend không chạy hoặc lỗi | Chạy `pm2 status` → nếu offline thì `pm2 restart homestay-api`; xem `pm2 logs homestay-api` |
| **CORS / 401** | `FRONTEND_ORIGIN` sai | Sửa `backend/.env`: `FRONTEND_ORIGIN=https://yourdomain.com` (không có `/` cuối) |
| **OAuth redirect sai** | Callback URL chưa cập nhật | Thêm `https://yourdomain.com/auth/google/callback` (và Facebook tương tự) trong Google/Facebook Developer |
| **Session không lưu / đăng xuất liên tục** | Chạy HTTP thay vì HTTPS | Phải dùng HTTPS; với `NODE_ENV=production` cookie `secure: true` bắt buộc |
| **SQLite permission denied** | Thư mục backend không có quyền ghi | `chown -R www-data:www-data /var/www/homestay-app-full` hoặc `chmod 755 backend` |
| **npm install better-sqlite3 fails** | Thiếu build tools | `apt install -y build-essential python3` rồi chạy lại `npm install` trong backend |
| **Trang trắng / 404 khi reload** | SPA routing | Kiểm tra Nginx có `try_files $uri $uri/ /index.html;` trong `location /` |

---

## Tham khảo

- [Cotabo Documentation](https://www.cotabo.de/en/support/)
- [PM2 Docs](https://pm2.keymetrics.io/)
- [Certbot](https://certbot.eff.org/)
