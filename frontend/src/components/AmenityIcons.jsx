import React from "react";

export const AMENITIES = [
  { key: "wifi", label: "Wi‑Fi", icon: "📶", desc: "Internet tốc độ cao" },
  { key: "kitchen", label: "Bếp", icon: "🍳", desc: "Có khu bếp nấu" },
  { key: "parking", label: "Bãi xe", icon: "🅿️", desc: "Chỗ để xe rộng" },
  { key: "ac", label: "Điều hoà", icon: "❄️", desc: "Mát lạnh 24/7" },
  { key: "tv", label: "TV", icon: "📺", desc: "Smart TV" },
  { key: "washer", label: "Giặt ủi", icon: "🧺", desc: "Máy giặt/ủi" },
  { key: "pool", label: "Hồ bơi", icon: "🏊", desc: "Thư giãn" },
  { key: "pet", label: "Pet‑friendly", icon: "🐶", desc: "Cho phép thú cưng" },
  { key: "bbq", label: "BBQ", icon: "🔥", desc: "Khu nướng BBQ" }
];

export function AmenitiesGrid({ amenities = [] }) {
  const set = new Set(amenities || []);
  const list = AMENITIES.filter(a => set.has(a.key));
  if (!list.length) return <div className="muted">Chưa cập nhật tiện ích.</div>;

  return (
    <div className="amenities">
      {list.map(a => (
        <div key={a.key} className="amenity">
          <div className="ic">{a.icon}</div>
          <div>
            <div className="name">{a.label}</div>
            <div className="desc">{a.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
