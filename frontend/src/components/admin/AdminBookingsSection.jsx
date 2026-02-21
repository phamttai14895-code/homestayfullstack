import React, { useState } from "react";
import {
  adminSyncGoogleSheet,
  adminDeleteReview,
  adminReplyReview,
  fetchRoomReviews,
  BASE,
} from "../../api";
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div className="section-title">Booking</div>
        <div className="row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={sheetSyncLoading}
            onClick={handleSyncSheet}
          >
            {sheetSyncLoading ? "Đang đồng bộ…" : "Đồng bộ Google Sheet"}
          </button>
        </div>
      </div>
      {sheetSyncMsg && (
        <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>{sheetSyncMsg}</div>
      )}

      <div className="admin-booking-filters">
        <div className="searchbar" style={{ marginTop: 0, flex: "1 1 200px" }}>
          <span>🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo code / id / tên / SĐT..."
            aria-label="Tìm booking"
          />
          <span className="count">{bookings.length}</span>
        </div>
        <div className="admin-booking-chips">
          {statusChips.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`chip ${statusChip === s.key ? "on" : ""}`}
              onClick={() => setStatusChip(s.key)}
              aria-pressed={statusChip === s.key}
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

      <div className="card2 bulkbar" style={{ marginTop: 12 }}>
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
        <div className="admin-booking-pagination" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {bookingPagination.pageItems.map((b, i) => {
          const idx = bookingPagination.start + i;
          return (
            <AdminBookingRow
              key={b.id}
              booking={b}
              isSelected={isSelected(b.id)}
              onToggleSelect={(e) => toggleOne(b.id, idx, e)}
              onStatusChange={setBStatus}
              onDelete={deleteSinglePro}
              onMarkPaid={markPaid}
            />
          );
        })}
        {!bookings.length && (
          <div className="muted">Chưa có booking (hoặc filter không có kết quả).</div>
        )}
      </div>
    </>
  );
}
