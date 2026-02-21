import React from "react";
import {
  bookingStatusLabel,
  bookingStatusClass,
  paymentStatusLabel,
  paymentStatusClass,
  paymentMethodLabel
} from "../../utils/labels";

/**
 * Một dòng booking trong admin: checkbox, thông tin đơn, trạng thái, nút Đang chờ / Xác nhận / Hủy / Xóa / Đánh dấu thanh toán.
 */
export default function AdminBookingRow({
  booking: b,
  isSelected,
  onToggleSelect,
  onStatusChange,
  onDelete,
  onMarkPaid
}) {
  return (
    <div className={`card2 ${isSelected ? "selected" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={{ marginTop: 6 }}
          />

          <div>
            <b>#{b.id}</b> • <span className="badge">{b.lookup_code}</span> • <b>{b.full_name}</b> • {b.phone}
            <div className="muted">
              {b.room_name} •{" "}
              {b.booking_type === "hourly"
                ? `${b.check_in} ${b.check_in_time || ""}-${b.check_out_time || ""}`
                : `${b.check_in} → ${b.check_out}`}{" "}
              • {b.guests} khách
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              Thanh toán: <b>{paymentMethodLabel(b.payment_method)}</b> • Trạng thái:{" "}
              <span className={paymentStatusClass(b.payment_status)}>{paymentStatusLabel(b.payment_status)}</span>
            </div>
          </div>
        </div>

        <div className="badges">
          <span className={bookingStatusClass(b.status)}>{bookingStatusLabel(b.status)}</span>

          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onStatusChange(b.id, "pending")}>
            Đang chờ
          </button>

          {b.payment_method === "cash" && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => onStatusChange(b.id, "confirmed")}>
              Xác nhận
            </button>
          )}

          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onStatusChange(b.id, "canceled")}>
            Hủy
          </button>

          <button
            className="btn danger btn-sm"
            type="button"
            onClick={() => onDelete(b.id)}
            title="Xóa (có thể hoàn tác trong 8 giây)"
          >
            Xóa
          </button>

          {b.payment_method === "cash" && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => onMarkPaid(b)}>
              Đánh dấu thanh toán
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
