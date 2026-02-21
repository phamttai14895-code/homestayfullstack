import React, { useEffect, useState } from "react";
import { imageUrl } from "../../api";

/**
 * Thẻ đánh giá trong admin: nội dung, ảnh, phản hồi chủ homestay, nút xóa / phản hồi.
 */
export default function AdminReviewCard({ rev, onDelete, onReply, onImageClick, BASE }) {
  const [replyText, setReplyText] = useState(rev.admin_reply || "");
  const [submitting, setSubmitting] = useState(false);
  const images = Array.isArray(rev.image_urls) ? rev.image_urls : [];

  useEffect(() => {
    setReplyText(rev.admin_reply || "");
  }, [rev.admin_reply]);

  return (
    <div className="card2" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>{rev.user_name || "Khách"}</span>
            <span style={{ color: "#b45309", fontWeight: 700 }}>{rev.stars} ★</span>
          </div>
          {rev.comment && <div className="muted" style={{ fontSize: 14 }}>{rev.comment}</div>}
          {images.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Hình ảnh thực tế từ khách</div>
              <div className="review-thumbs">
                {images.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    className="review-thumb"
                    onClick={() => onImageClick?.(images.map(u => `${BASE}${u}`), i)}
                  >
                    <img src={imageUrl(url)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {rev.admin_reply && (
            <div style={{ marginTop: 8, padding: 8, background: "var(--pri-light)", borderRadius: 8, fontSize: 14 }}>
              <strong>Phản hồi chủ homestay:</strong> {rev.admin_reply}
              {rev.admin_reply_at && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{rev.admin_reply_at}</span>}
            </div>
          )}
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{rev.created_at}</div>
        </div>
        <button type="button" className="btn danger btn-sm" onClick={onDelete}>Xóa</button>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Chủ homestay phản hồi đánh giá..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }}
        />
        <button
          type="button"
          className="btn btn-sm"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onReply(replyText);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Đang gửi…" : "Phản hồi"}
        </button>
      </div>
    </div>
  );
}
