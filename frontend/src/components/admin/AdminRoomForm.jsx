import React from "react";
import { AMENITIES } from "../AmenityIcons.jsx";

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

/**
 * Form tạo/sửa phòng: tên, địa điểm, giá đêm/giờ, mô tả, tiện ích, nút Lưu / Đặt lại.
 */
export default function AdminRoomForm({ form, setForm, onSave, onReset }) {
  return (
    <form onSubmit={onSave} style={{ display: "grid", gap: 10 }}>
      <div className="row2">
        <div className="input">
          <label>Tên phòng</label>
          <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
        </div>
        <div className="input">
          <label>Địa điểm</label>
          <input value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} />
        </div>
      </div>

      <div className="row2">
        <div className="input">
          <label>Giá/đêm</label>
          <input
            type="number"
            min="0"
            value={form.price_per_night}
            onChange={(e) => setForm((s) => ({ ...s, price_per_night: e.target.value }))}
          />
        </div>
        <div className="input">
          <label>Giá/giờ</label>
          <input
            type="number"
            min="0"
            value={form.price_per_hour ?? 0}
            onChange={(e) => setForm((s) => ({ ...s, price_per_hour: e.target.value }))}
          />
        </div>
      </div>
      <div className="row2">
        <div className="input">
          <label>Mô tả ngắn</label>
          <input value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
        </div>
      </div>

      <div>
        <div className="muted" style={{ fontWeight: 900, marginBottom: 8 }}>Tiện ích</div>
        <div className="chips">
          {AMENITIES.map((a) => {
            const on = safeArr(form.amenities).includes(a.key);
            return (
              <button
                type="button"
                key={a.key}
                className={`chip ${on ? "on" : ""}`}
                onClick={() => {
                  setForm((s) => {
                    const arr = new Set(safeArr(s.amenities));
                    if (arr.has(a.key)) arr.delete(a.key);
                    else arr.add(a.key);
                    return { ...s, amenities: Array.from(arr) };
                  });
                }}
                title={a.label}
              >
                <span style={{ marginRight: 6 }}>{a.icon}</span>
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="row">
        <button className="btn" type="submit">
          {form.id ? "Cập nhật" : "Tạo phòng"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onReset}>
          Đặt lại
        </button>
      </div>
    </form>
  );
}
