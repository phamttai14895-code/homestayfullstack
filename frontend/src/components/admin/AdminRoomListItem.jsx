import React from "react";
import { imageUrl } from "../../api";

/** Một dòng phòng trong danh sách admin: ảnh, tên, giá, nút Sửa / Ảnh / Giá/ngày / Đánh giá / Xoá. */
export default function AdminRoomListItem({ room, BASE, onEdit, onPickImages, onDayPrices, onReviews, onDelete }) {
  const cover = room.image_url ? imageUrl(room.image_url) : "";
  return (
    <div className="card2">
      <div className="room-row">
        <div className="room-meta">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 70, height: 52, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(15,23,42,.08)", background: "#fff", boxShadow: "var(--shadow2)" }}>
              {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div className="ph" style={{ display: "grid", placeItems: "center", height: "100%" }}>No</div>}
            </div>
            <div>
              <div style={{ fontWeight: 950 }}>{room.name}</div>
              <div className="muted">{room.location} • {Number(room.price_per_night || 0).toLocaleString()}đ/đêm • {Number(room.price_per_hour || 0).toLocaleString()}đ/giờ</div>
            </div>
          </div>
        </div>
        <div className="room-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onEdit(room)}>Sửa</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onPickImages(room)}>Ảnh</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onDayPrices(room)}>Giá/ngày</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onReviews(room)}>Đánh giá</button>
          <button className="btn danger btn-sm" type="button" onClick={() => onDelete(room.id)}>Xoá</button>
        </div>
      </div>
    </div>
  );
}
