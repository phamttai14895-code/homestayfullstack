#!/bin/bash
# Gỡ backend/credentials/google-sheets.json khỏi toàn bộ lịch sử Git để push không bị GitHub chặn.
# Chạy trong thư mục gốc project: bash fix-secret-push.sh

set -e
echo "=== Đang xóa file credentials khỏi lịch sử Git ==="

# Xóa file khỏi mọi commit (giữ file trên máy)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/credentials/google-sheets.json 2>/dev/null || true" \
  --prune-empty HEAD

echo ""
echo "=== Xong. Giờ chạy: git push --force origin main ==="
echo "Lưu ý: Nếu đã clone repo ở chỗ khác, cần clone lại hoặc git pull --rebase sau khi push."
