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
  onShowDetail
}) {
  const sourceLabel = b.source === "google_sheet" ? "Google Sheet" : "Web";
  const dateStr = b.booking_type === "hourly"
    ? `${b.check_in} ${b.check_in_time || ""}–${b.check_out_time || ""}`
    : `${b.check_in} → ${b.check_out}`;

  return (
    <div className={`admin-booking-card ${isSelected ? "selected" : ""}`}>
      <div className="admin-booking-card__inner">
        <label className="admin-booking-card__check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        </label>

        <div
          className="admin-booking-card__main"
          role="button"
          tabIndex={0}
          onClick={() => onShowDetail?.(b)}
          onKeyDown={(e) => e.key === "Enter" && onShowDetail?.(b)}
        >
          <div className="admin-booking-card__head">
            <span className="admin-booking-card__id">#{b.id}</span>
            <span className="admin-booking-card__code">{b.lookup_code}</span>
            <span className={`admin-booking-card__source admin-booking-card__source--${b.source === "google_sheet" ? "sheet" : "web"}`}>
              {sourceLabel}
            </span>
            <span className={`admin-booking-card__status ${bookingStatusClass(b.status)}`}>
              {bookingStatusLabel(b.status)}
            </span>
          </div>
          <div className="admin-booking-card__info">
            <div className="admin-booking-card__line">
              <strong>{b.full_name}</strong>
              <span>{b.phone}</span>
            </div>
            <div className="admin-booking-card__line muted">
              {b.room_name} · {dateStr} · {b.guests} khách
            </div>
            <div className="admin-booking-card__line muted">
              {paymentMethodLabel(b.payment_method)} ·{" "}
              <span className={paymentStatusClass(b.payment_status)}>{paymentStatusLabel(b.payment_status)}</span>
            </div>
            {onShowDetail && (
              <span className="admin-booking-card__hint">Xem chi tiết</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
