# Gỡ file credentials khỏi Git và push lại (sau khi bị GitHub chặn)

GitHub chặn push vì **commit 70858f79** (hoặc commit khác) có chứa **backend/credentials/google-sheets.json**. Cần xóa file này khỏi **toàn bộ lịch sử** rồi force push.

---

## Cách 1: Dùng script (khuyên dùng)

Trong thư mục gốc project (homestay-app-full), mở terminal:

```bash
bash fix-secret-push.sh
```

Sau đó:

```bash
git push --force origin main
```

(Nếu nhánh là `master` thì dùng `git push --force origin master`.)

---

## Cách 2: Tự chạy lệnh

Chạy trong thư mục gốc project:

```bash
# Xóa file khỏi mọi commit (file vẫn nằm trên máy)
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/credentials/google-sheets.json 2>/dev/null || true" --prune-empty HEAD

# Đẩy lại (ghi đè lịch sử trên GitHub)
git push --force origin main
```

---

## Sau khi push thành công

1. **Đổi key (khuyến nghị):** Key có thể đã bị GitHub quét. Vào [Google Cloud Console](https://console.cloud.google.com/) → Service Accounts → tạo key mới (hoặc vô hiệu hóa key cũ), tải JSON mới. Thay file **backend/credentials/google-sheets.json** trên máy và VPS. **Không commit file này.**

2. **Nếu có bản clone khác:** Sau khi push force, repo đó sẽ lệch lịch sử. Tốt nhất là `git fetch origin && git reset --hard origin/main` (hoặc clone lại).

---

## Lưu ý

- `.gitignore` đã có `**/credentials/` và `**/credentials/*.json` nên file credentials sẽ không bị add lại.
- **Không** dùng link "allow the secret" của GitHub — key sẽ vẫn bị coi là lộ.
