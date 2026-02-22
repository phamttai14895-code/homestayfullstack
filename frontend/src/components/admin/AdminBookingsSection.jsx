import React, { useState } from "react";
import {
  adminSyncGoogleSheet,
  adminDeleteReview,
  adminReplyReview,
  fetchRoomReviews,
  BASE,
} from "../../api";
import {
  bookingStatusLabel,
  bookingStatusClass,
  paymentStatusLabel,
  paymentStatusClass,
  paymentMethodLabel,
} from "../../utils/labels";
import AdminReviewCard from "./AdminReviewCard.jsx";
import AdminBookingRow from "./AdminBookingRow.jsx";

/**
 * Phần bên phải Admin: đồng bộ Sheet, filter booking, panel đánh giá/giá theo ngày, bulk bar, pagination, danh sách booking.
 */
export default function AdminBookingsSection({
  // Booking hook
  q,
  setQ,
  bookings,
  statusChips,
  statusChip,
  setStatusChip,
  sourceChips,
  sourceChip,
  setSourceChip,
  bookingPagination,
  setBookingPage,
  BOOKING_PAGE_SIZE,
  loadBookings,
  selectAllRef,
  selectedCount,
  toggleAll,
  toggleOne,
  isSelected,
  clearSelection,
  deleteSelectedPro,
  deleteSinglePro,
  setBStatus,
  markPaid,
  // Room hook (panels)
  dayPricesPanel,
  setDayPricesPanel,
  setDayPrice,
  loadDayPricesForMonth,
  // Reviews hook
  reviewsPanel,
  setReviewsPanel,
  setLbReview,
}) {
  const [sheetSyncLoading, setSheetSyncLoading] = useState(false);
  const [sheetSyncMsg, setSheetSyncMsg] = useState("");
  const [detailBooking, setDetailBooking] = useState(null);

  const handleSyncSheet = async () => {
    setSheetSyncMsg("");
    setSheetSyncLoading(true);
    try {
      const d = await adminSyncGoogleSheet();
      let msg = d.message || "Đã đồng bộ " + (d.synced || 0) + " đặt phòng.";
      if ((d.synced === 0 && d.rawRowCount > 0) && Array.isArray(d.roomNames) && d.roomNames.length > 0) {
        msg += " Cột A trong Sheet phải là một trong: " + d.roomNames.join(", ");
      }
      setSheetSyncMsg(msg);
      if (d.synced >= 0) loadBookings();
    } catch (e) {
      setSheetSyncMsg(e?.message || "Lỗi đồng bộ");
    } finally {
      setSheetSyncLoading(false);
    }
  };

  return (
    <>
      <div className="admin-booking-header">
        <h2 className="admin-booking-title">Booking</h2>
        <button
          type="button"
          className="btn btn-sm admin-booking-sync-btn"
          disabled={sheetSyncLoading}
          onClick={handleSyncSheet}
        >
          {sheetSyncLoading ? "Đang đồng bộ…" : "Đồng bộ Google Sheet"}
        </button>
      </div>
      {sheetSyncMsg && (
        <div className="admin-booking-sync-msg muted">{sheetSyncMsg}</div>
      )}

      <div className="admin-booking-filters card2">
        <div className="searchbar">
          <span>🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo code / id / tên / SĐT..."
            aria-label="Tìm booking"
          />
          <span className="count">{bookings.length}</span>
        </div>
        <div className="admin-booking-chips admin-booking-chips--status">
          <span className="admin-booking-chips-label muted">Trạng thái:</span>
          {statusChips.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`chip ${statusChip === s.key ? "on" : ""} ${statusChip === s.key && s.key ? `chip--${s.key}` : ""}`}
              onClick={() => setStatusChip(s.key)}
              aria-pressed={statusChip === s.key}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="admin-booking-chips admin-booking-chips--source">
          <span className="admin-booking-chips-label muted">Nguồn:</span>
          {sourceChips.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`chip ${sourceChip === s.key ? "on" : ""}`}
              onClick={() => setSourceChip(s.key)}
              aria-pressed={sourceChip === s.key}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {reviewsPanel && (
        <div className="card2" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 950 }}>Đánh giá: {reviewsPanel.roomName}</div>
              <div className="muted">Xóa đánh giá vi phạm hoặc spam. Thao tác không hoàn tác được.</div>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setReviewsPanel(null)}>Đóng</button>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {reviewsPanel.reviews.length === 0 ? (
              <div className="muted">Chưa có đánh giá.</div>
            ) : (
              reviewsPanel.reviews.map((rev) => (
                <AdminReviewCard
                  key={rev.id}
                  rev={rev}
                  onImageClick={(imgs, idx) => setLbReview({ open: true, images: imgs, index: idx })}
                  onDelete={async () => {
                    if (!confirm("Xóa đánh giá này?")) return;
                    try {
                      await adminDeleteReview(rev.id);
                      const d = await fetchRoomReviews(reviewsPanel.roomId);
                      setReviewsPanel((p) => ({ ...p, reviews: d.reviews || [] }));
                    } catch (e) {
                      alert("Lỗi xóa: " + (e?.message || e));
                    }
                  }}
                  onReply={async (reply) => {
                    try {
                      await adminReplyReview(rev.id, reply);
                      const d = await fetchRoomReviews(reviewsPanel.roomId);
                      setReviewsPanel((p) => ({ ...p, reviews: d.reviews || [] }));
                    } catch (e) {
                      alert("Lỗi phản hồi: " + (e?.message || e));
                    }
                  }}
                  BASE={BASE}
                />
              ))
            )}
          </div>
        </div>
      )}

      {dayPricesPanel && (
        <div className="card2" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 950 }}>Giá theo ngày: {dayPricesPanel.roomName}</div>
              <div className="muted">Tháng {dayPricesPanel.month} • Click vào ô để chỉnh giá (trống = dùng giá mặc định)</div>
            </div>
            <div className="row">
              <input
                type="month"
                value={dayPricesPanel.month}
                onChange={async (e) => {
                  const month = e.target.value;
                  if (!month) return;
                  await loadDayPricesForMonth(month);
                }}
                style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.14)" }}
                aria-label="Chọn tháng"
              />
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDayPricesPanel(null)}>Đóng</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 12 }}>
            {(() => {
              const [y, m] = dayPricesPanel.month.split("-").map(Number);
              const lastDay = new Date(y, m, 0).getDate();
              const cells = [];
              for (let d = 1; d <= lastDay; d++) {
                const iso = `${dayPricesPanel.month}-${String(d).padStart(2, "0")}`;
                const val = dayPricesPanel.day_prices[iso];
                cells.push(
                  <div key={iso} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="muted" style={{ fontSize: 11 }}>{d}/{m}</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="mặc định"
                      value={val ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDayPricesPanel((s) => ({
                          ...s,
                          day_prices: { ...s.day_prices, [iso]: v === "" ? undefined : Number(v) },
                        }));
                      }}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        const num = v === "" ? null : Number(v);
                        if (num !== null && !Number.isNaN(num)) {
                          await setDayPrice(dayPricesPanel.roomId, iso, num);
                        }
                      }}
                      style={{ padding: "6px 8px", fontSize: 12, borderRadius: 8, border: "1px solid rgba(15,23,42,.12)" }}
                      aria-label={`Giá ngày ${d}/${m}`}
                    />
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      )}

      <div className="admin-booking-bulkbar card2 bulkbar">
        <div className="bulk-left">
          <label className="bulk-check">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={bookingPagination.pageItems.length > 0 && bookingPagination.pageItems.every((b) => isSelected(b.id))}
              onChange={toggleAll}
              aria-label="Chọn tất cả trang này"
            />
            <span>Chọn tất cả (trang này)</span>
          </label>
          <span className="muted">
            Đã chọn: <b>{selectedCount}</b> / {bookings.length}
            <span className="muted" style={{ marginLeft: 8 }}>• Shift+click để chọn dải</span>
          </span>
        </div>
        <div className="bulk-right">
          {selectedCount > 0 && (
            <>
              <button className="btn btn-ghost btn-sm" type="button" onClick={clearSelection}>Bỏ chọn</button>
              <button className="btn danger btn-sm" type="button" onClick={deleteSelectedPro}>Xóa đã chọn</button>
            </>
          )}
        </div>
      </div>

      {bookings.length > BOOKING_PAGE_SIZE && (
        <div className="admin-booking-pagination">
          <span className="muted">
            Đơn <b>{bookingPagination.start + 1}</b>–<b>{bookingPagination.start + bookingPagination.pageItems.length}</b> / {bookings.length}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={bookingPagination.currentPage <= 1}
              onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
              aria-label="Trang trước"
            >
              ← Trước
            </button>
            <span className="muted" style={{ fontSize: 13 }}>
              Trang {bookingPagination.currentPage} / {bookingPagination.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={bookingPagination.currentPage >= bookingPagination.totalPages}
              onClick={() => setBookingPage((p) => Math.min(bookingPagination.totalPages, p + 1))}
              aria-label="Trang sau"
            >
              Sau →
            </button>
          </div>
        </div>
      )}

      <div className="admin-booking-list">
        {bookingPagination.pageItems.map((b, i) => {
          const idx = bookingPagination.start + i;
          return (
            <AdminBookingRow
              key={b.id}
              booking={b}
              isSelected={isSelected(b.id)}
              onToggleSelect={(e) => toggleOne(b.id, idx, e)}
              onShowDetail={(bk) => setDetailBooking(bk)}
            />
          );
        })}
        {!bookings.length && (
          <div className="muted">Chưa có booking (hoặc filter không có kết quả).</div>
        )}
      </div>

      {detailBooking && (
        <div
          className="admin-booking-detail-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-detail-title"
          onClick={() => setDetailBooking(null)}
        >
          <div
            className="admin-booking-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-booking-detail-header">
              <h2 id="booking-detail-title">Chi tiết đơn #{detailBooking.id}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailBooking(null)}>
                Đóng
              </button>
            </div>
            <div className="admin-booking-detail-body">
              <div className="admin-booking-detail-grid">
                <div><span className="muted">Mã đơn:</span> <b>{detailBooking.lookup_code}</b></div>
                <div><span className="muted">Nguồn:</span> {detailBooking.source === "google_sheet" ? "Google Sheet" : "Web"}</div>
                <div><span className="muted">Phòng:</span> {detailBooking.room_name}</div>
                <div><span className="muted">Loại đặt:</span> {detailBooking.booking_type === "hourly" ? "Theo giờ" : "Qua đêm"}</div>
                <div><span className="muted">Họ tên:</span> {detailBooking.full_name}</div>
                <div><span className="muted">SĐT:</span> {detailBooking.phone}</div>
                <div><span className="muted">Email:</span> {detailBooking.email || "—"}</div>
                <div><span className="muted">Check-in:</span> {detailBooking.check_in} {detailBooking.check_in_time ? `(${detailBooking.check_in_time})` : ""}</div>
                <div><span className="muted">Check-out:</span> {detailBooking.check_out} {detailBooking.check_out_time ? `(${detailBooking.check_out_time})` : ""}</div>
                <div><span className="muted">Số khách:</span> {detailBooking.guests}</div>
                <div><span className="muted">Ghi chú:</span> {detailBooking.note || "—"}</div>
                <div><span className="muted">Tổng tiền:</span> <b>{Number(detailBooking.total_amount || 0).toLocaleString()} ₫</b></div>
                <div><span className="muted">Đã thanh toán:</span> {Number(detailBooking.paid_amount || 0).toLocaleString()} ₫</div>
                <div><span className="muted">Thanh toán:</span> {paymentMethodLabel(detailBooking.payment_method)}</div>
                <div><span className="muted">Trạng thái thanh toán:</span> <span className={paymentStatusClass(detailBooking.payment_status)}>{paymentStatusLabel(detailBooking.payment_status)}</span></div>
                <div><span className="muted">Trạng thái đơn:</span> <span className={bookingStatusClass(detailBooking.status)}>{bookingStatusLabel(detailBooking.status)}</span></div>
              </div>
            </div>
            <div className="admin-booking-detail-actions">
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setBStatus(detailBooking.id, "pending"); setDetailBooking(null); }}>Đang chờ</button>
              {detailBooking.payment_method === "cash" && (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setBStatus(detailBooking.id, "confirmed"); setDetailBooking(null); }}>Xác nhận</button>
              )}
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setBStatus(detailBooking.id, "canceled"); setDetailBooking(null); }}>Hủy</button>
              {detailBooking.payment_method === "cash" && (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { markPaid(detailBooking); setDetailBooking(null); }}>Đánh dấu thanh toán</button>
              )}
              <button className="btn danger btn-sm" type="button" onClick={() => { deleteSinglePro(detailBooking.id); setDetailBooking(null); }}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
