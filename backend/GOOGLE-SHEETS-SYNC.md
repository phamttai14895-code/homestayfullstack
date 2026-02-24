# Hướng dẫn đồng bộ Google Sheet – Bảng báo cáo đặt phòng

Tài liệu này giải thích cách dùng tính năng đồng bộ 2 chiều giữa **web homestay** và **Google Sheet** dạng bảng lịch (BOOKING REPORT): cột A4–A34 là ngày, C3–M3 là tên phòng, ô C4:M34 hiển thị đơn đặt (tên khách, qua đêm/theo giờ, ngày hoặc giờ, trạng thái thanh toán).

---

## 1. Chuẩn bị

### 1.1. Tạo Service Account (Google Cloud)

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → chọn project (hoặc tạo mới).
2. **APIs & Services** → **Credentials** → **Create Credentials** → **Service account**.
3. Đặt tên (vd: `homestay-sheet`), tạo xong → vào service account vừa tạo.
4. Tab **Keys** → **Add key** → **Create new key** → chọn **JSON**, tải file về.
5. Đổi tên file thành `google-sheets.json` và đặt vào thư mục **backend**:  
   `backend/credentials/google-sheets.json`  
   (tạo thư mục `credentials` nếu chưa có).

### 1.2. Chia sẻ Google Sheet với Service Account

1. Mở file JSON vừa tải, tìm trường **`client_email`** (dạng `xxx@xxx.iam.gserviceaccount.com`).
2. Mở Google Sheet của bạn (bảng BOOKING REPORT) → **Chia sẻ** (Share).
3. Thêm địa chỉ `client_email` vào, chọn quyền **Chỉnh sửa** (Editor).
4. Lưu.

### 1.3. Lấy ID của Google Sheet

- Mở Sheet trong trình duyệt. URL có dạng:  
  `https://docs.google.com/spreadsheets/d/ **ID_Ở_ĐÂY** /edit ...`
- Copy đoạn **ID_Ở_ĐÂY** (chuỗi dài, không có dấu /).

---

## 2. Cấu trúc bảng Sheet (BOOKING REPORT)

Bảng nên có cấu trúc:

|     | A   | B    | C      | D      | … | M      |
|-----|-----|------|--------|--------|---|--------|
| 1   |     |      | (tiêu đề: BOOKING REPORT, tháng có thể ghi ở E1) | | | |
| 2   |     |      |        |        |   |        |
| **3** | (Ngày) | (Thứ) | **Tên phòng 1** | **Tên phòng 2** | … | **Tên phòng 11** |
| **4** | 1   | Chủ nhật | ô đặt phòng ngày 1 | … |   |        |
| 5   | 2   | Thứ 2  | …      | …      |   |        |
| …   | …   | …     | …      | …      |   |        |
| 34  | 31  | …     | …      | …      |   |        |

- **A4:A34** = số ngày trong tháng (1–31).
- **B4:B34** = thứ (Chủ nhật, Thứ 2, …). App có thể ghi đè khi đồng bộ.
- **C3:M3** = tên phòng. **Phải trùng tên phòng trong app** (đúng chữ, có thể khác hoa thường).
- **C4:M34** = nội dung đặt phòng từng ngày từng phòng. App sẽ **ghi** (Web→Sheet) hoặc **đọc** (Sheet→Web) theo format bên dưới.

---

## 3. Cấu hình trong `.env` (backend)

Trong file `backend/.env` (copy từ `backend/.env.example` rồi sửa):

```env
# Bắt buộc
GOOGLE_SHEETS_SPREADSHEET_ID=id_của_sheet_của_bạn
GOOGLE_SHEETS_CREDENTIALS_PATH=credentials/google-sheets.json

# Bảng báo cáo (dùng bảng lịch A4:M34)
GOOGLE_SHEETS_REPORT_RANGE=Sheet1!A3:M34
GOOGLE_SHEETS_REPORT_MONTH=2026-03
```
- **Sheet1** thay bằng đúng tên tab chứa bảng báo cáo (vd: `Report`, `Tháng 3`).
- **GOOGLE_SHEETS_REPORT_MONTH**: tháng/năm cần xem và ghi (YYYY-MM). Để trống = tháng hiện tại.

```env
# Đồng bộ tự động: mỗi N phút (0 = chỉ đồng bộ khi bấm nút)
GOOGLE_SHEETS_POLL_MINUTES=2
```

**Không bật bảng lịch:** Nếu **không** set `GOOGLE_SHEETS_REPORT_RANGE`, app dùng chế độ list (cột A=Phòng, B=Check-in, C=Check-out, D=status, E=Tên khách, F,G=giờ). Khi đó dùng thêm `GOOGLE_SHEETS_RANGE` và `GOOGLE_SHEETS_WEB_RANGE` như ghi chú trong `.env.example`.

---

## 4. Cách hoạt động

### 4.1. Web → Sheet (ghi từ web lên bảng lịch)

- **Khi nào chạy:** Mỗi lần đồng bộ (theo chu kỳ `GOOGLE_SHEETS_POLL_MINUTES` hoặc khi admin bấm **«Đồng bộ»** trong trang Admin).
- **Trước khi ghi:** App tự động **hủy đơn pending đã quá hạn** (SePay / expires_at). Đơn đã hủy không còn trong DB nên sẽ **không được ghi lên sheet** (coi như “xóa khỏi sheet” vì toàn bộ vùng C4:M34 được ghi lại từ DB).
- **Chỉ ghi đơn:** Đã **xác nhận** và **đã thanh toán** (trạng thái confirmed, và payment_status = paid hoặc paid_amount ≥ total_amount).
- **Nội dung mỗi ô:**
  - **Qua đêm:**  
    `Tên khách | Qua đêm dd/mm-dd/mm | Đã TT`  
    Ví dụ: `Nguyễn Văn A | Qua đêm 01/03-05/03 | Đã TT`
  - **Theo giờ:**  
    `Tên khách | Theo giờ HH:mm-HH:mm | Đã TT`  
    Ví dụ: `Trần B | Theo giờ 08:00-12:00 | Đã TT`
- App sẽ:
  - Xóa nội dung cũ vùng **C4:M34**,
  - Ghi lại **A4:B34** (ngày, thứ),
  - Ghi lại **C3:M3** (tên phòng từ danh sách phòng trong app),
  - Ghi nội dung đặt phòng vào **C4:M34** theo từng ngày/từng phòng.

### 4.2. Sheet → Web (đọc từ bảng lịch vào web)

- **Khi nào chạy:** Cùng lúc với đồng bộ (chu kỳ poll hoặc nút «Đồng bộ»).
- **Cách đọc:** App đọc range **A3:M34**:
  - Hàng 1 của range (row 3 trong Sheet): **C3:M3** = tên phòng → map với phòng trong app (theo tên).
  - Các hàng tiếp (4–34): mỗi hàng = một ngày (1–31). Tháng/năm lấy từ **GOOGLE_SHEETS_REPORT_MONTH** (hoặc tháng hiện tại).
- **Format ô app hiểu:**
  - Qua đêm: `Tên khách | Qua đêm dd/mm-dd/mm` (có thể thêm `| Đã TT` phía sau).
  - Theo giờ: `Tên khách | Theo giờ HH:mm-HH:mm` hoặc dạng `HH:mm-HH:mm`.
- **Sau khi đọc:** App **xóa toàn bộ đơn có source = google_sheet** trong DB, rồi **thêm mới** các đơn vừa parse từ sheet. Đơn từ sheet mặc định là **confirmed**, **paid** (chỉ dùng để chặn lịch / hiển thị).

Nếu bạn **sửa tay** nội dung ô trong C4:M34 đúng format trên, lần đồng bộ tiếp theo app sẽ đọc lại và cập nhật lịch trên web tương ứng.

---

## 5. Tóm tắt nhanh

| Việc | Cách làm |
|------|----------|
| Chỉ xem báo cáo từ web | Bật `GOOGLE_SHEETS_REPORT_RANGE` + `REPORT_MONTH`, không cần sửa sheet tay. App ghi đơn đã xác nhận + đã TT lên sheet. |
| Sửa/ghi tay trên sheet rồi đưa lên web | Sửa ô C4:M34 đúng format (Tên \| Qua đêm dd/mm-dd/mm hoặc Theo giờ HH:mm-HH:mm). Bấm «Đồng bộ» hoặc chờ poll → app đọc và cập nhật DB. |
| Đơn pending quá 5 phút / hết hạn | App tự hủy trước mỗi lần sync; đơn đó không ghi lên sheet (và không còn trên sheet sau khi ghi lại grid). |
| Đổi tháng báo cáo | Đổi `GOOGLE_SHEETS_REPORT_MONTH=YYYY-MM` (vd: `2026-04`) rồi restart backend (hoặc chờ lần sync tiếp theo). |

---

## 6. Xử lý lỗi thường gặp

- **Không ghi/đọc được sheet:** Kiểm tra đã share sheet cho `client_email` trong file JSON với quyền Chỉnh sửa chưa; `GOOGLE_SHEETS_SPREADSHEET_ID` đúng chưa; tên tab trong `GOOGLE_SHEETS_REPORT_RANGE` đúng chưa.
- **Tên phòng không khớp:** C3:M3 phải trùng tên phòng trong app (có thể khác hoa/thường). Nếu đổi tên phòng trên app, lần ghi tiếp theo app sẽ ghi lại row 3 theo tên mới.
- **Đơn không lên sheet:** Chỉ đơn **confirmed** và **đã thanh toán** mới được ghi. Kiểm tra trạng thái đơn và thanh toán trong Admin.

Nếu bạn dùng chế độ list (không dùng bảng lịch), xem thêm comment trong `backend/.env.example` cho `GOOGLE_SHEETS_RANGE` và `GOOGLE_SHEETS_WEB_RANGE`.
