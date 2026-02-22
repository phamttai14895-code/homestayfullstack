import React, { useCallback } from "react";
import { Link } from "react-router-dom";
import { BASE, imageUrl } from "../api";
import { usePageTitle } from "../utils/usePageTitle";
import { safeArr } from "../utils/parse.js";
import Lightbox from "../components/Lightbox.jsx";
import { useUser } from "../context/User.jsx";
import AdminRoomForm from "../components/admin/AdminRoomForm.jsx";
import AdminRoomListItem from "../components/admin/AdminRoomListItem.jsx";
import AdminBookingsSection from "../components/admin/AdminBookingsSection.jsx";
import { useAdminBookings } from "../hooks/useAdminBookings.js";
import { useAdminRooms } from "../hooks/useAdminRooms.js";
import { useAdminReviews } from "../hooks/useAdminReviews.js";

export default function AdminDashboard() {
  const { me } = useUser();
  const bookings = useAdminBookings();
  const rooms = useAdminRooms();
  const reviews = useAdminReviews();

  usePageTitle("Quản trị Homestay");

  const handleSetBStatus = useCallback(
    async (id, status) => {
      try {
        await bookings.setBStatus(id, status);
      } catch (e) {
        rooms.setErr(e?.message || "Lỗi");
      }
    },
    [bookings, rooms]
  );

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>Quản trị Homestay</h1>
          <p>
            {me
              ? `${me.email} • Quản lý phòng, đặt phòng, đánh giá`
              : "Bạn cần đăng nhập bằng Google (email trong ADMIN_EMAILS)"}
          </p>
        </div>
        <div className="row">
          {me && (
            <Link className="btn btn-sm" to="/admin/stats">Thống kê & Doanh thu</Link>
          )}
          {!me && (
            <a className="btn btn-ghost btn-sm" href={`${BASE}/auth/google`}>Đăng nhập</a>
          )}
        </div>
      </div>

      {rooms.err && <p className="error-message">{rooms.err}</p>}

      <div className="grid2">
        {/* LEFT: Rooms */}
        <div className="card2">
          <div className="section-title">Phòng</div>
          <AdminRoomForm
            form={rooms.roomForm}
            setForm={rooms.setRoomForm}
            onSave={rooms.saveRoom}
            onReset={rooms.resetForm}
          />
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {rooms.rooms.map((r) => (
              <AdminRoomListItem
                key={r.id}
                room={r}
                BASE={BASE}
                onEdit={(room) =>
                  rooms.setRoomForm({
                    ...room,
                    amenities: rooms.parseAmenities(room.amenities),
                    price_per_hour: room.price_per_hour ?? 0,
                  })
                }
                onPickImages={rooms.pickRoom}
                onDayPrices={rooms.openDayPrices}
                onReviews={reviews.openReviews}
                onDelete={rooms.removeRoom}
              />
            ))}
            {!rooms.rooms.length && <div className="muted">Chưa có phòng.</div>}
          </div>
        </div>

        {/* RIGHT: Images panel + Bookings section */}
        <div className="card2">
          <div ref={rooms.imagePanelRef} className="scroll-anchor">
            {rooms.pickedRoom && (
              <div className="card2" style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 950 }}>Ảnh phòng: {rooms.pickedRoom.name}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Kéo thả để sắp xếp • Click &quot;Thumbnail&quot; để chọn ảnh đại diện • Xoá sẽ xoá file trong uploads.
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => rooms.setPickedRoom(null)}
                  >
                    Đóng
                  </button>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => rooms.uploadMulti(Array.from(e.target.files || []))}
                    aria-label="Chọn ảnh tải lên"
                  />
                </div>
                <div className="mini-gallery">
                  {safeArr(rooms.pickedRoom.image_urls).map((u, i) => {
                    const isThumb =
                      rooms.pickedRoom.image_url === u ||
                      (!rooms.pickedRoom.image_url && i === 0);
                    const src = imageUrl(u);
                    return (
                      <div
                        key={u}
                        className={`mini-img ${isThumb ? "thumb" : ""}`}
                        draggable
                        onDragStart={() => rooms.onDragStart(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => rooms.onDrop(i)}
                        title="Kéo thả để sắp xếp"
                      >
                        <img src={src} alt="" />
                        <div className="mini-actions">
                          <button
                            className={`mini-set ${isThumb ? "on" : ""}`}
                            type="button"
                            onClick={() => rooms.setThumb(u)}
                          >
                            {isThumb ? "Thumbnail ✓" : "Đặt thumbnail"}
                          </button>
                          <button className="x" type="button" onClick={() => rooms.delImg(u)}>
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!safeArr(rooms.pickedRoom.image_urls).length && (
                    <div className="muted">Chưa có ảnh.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <AdminBookingsSection
            q={bookings.q}
            setQ={bookings.setQ}
            bookings={bookings.bookings}
            statusChips={bookings.statusChips}
            statusChip={bookings.statusChip}
            setStatusChip={bookings.setStatusChip}
            sourceChips={bookings.sourceChips}
            sourceChip={bookings.sourceChip}
            setSourceChip={bookings.setSourceChip}
            bookingPagination={bookings.bookingPagination}
            setBookingPage={bookings.setBookingPage}
            BOOKING_PAGE_SIZE={bookings.BOOKING_PAGE_SIZE}
            loadBookings={bookings.loadBookings}
            selectAllRef={bookings.selectAllRef}
            selectedCount={bookings.selectedCount}
            toggleAll={bookings.toggleAll}
            toggleOne={bookings.toggleOne}
            isSelected={bookings.isSelected}
            clearSelection={bookings.clearSelection}
            deleteSelectedPro={bookings.deleteSelectedPro}
            deleteSinglePro={bookings.deleteSinglePro}
            setBStatus={handleSetBStatus}
            markPaid={bookings.markPaid}
            dayPricesPanel={rooms.dayPricesPanel}
            setDayPricesPanel={rooms.setDayPricesPanel}
            setDayPrice={rooms.setDayPrice}
            loadDayPricesForMonth={rooms.loadDayPricesForMonth}
            setPricePresets={rooms.setPricePresets}
            addHoliday={rooms.addHoliday}
            removeHoliday={rooms.removeHoliday}
            importVietnamHolidays={rooms.importVietnamHolidays}
            reviewsPanel={reviews.reviewsPanel}
            setReviewsPanel={reviews.setReviewsPanel}
            setLbReview={reviews.setLbReview}
          />
        </div>
      </div>

      {bookings.undoState && (
        <div className="toast-undo" role="status">
          <div className="toast-undo-inner">
            <div style={{ fontWeight: 950 }}>Đã xóa {bookings.undoState.ids.length} booking.</div>
            <div className="muted" style={{ marginTop: 2 }}>
              Hoàn tác trong <b>{bookings.remainingSec}s</b>
            </div>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={bookings.undoDelete}
              >
                Undo
              </button>
              <button
                className="btn btn-sm"
                type="button"
                onClick={bookings.confirmUndoDeleteNow}
                title="Xác nhận xóa ngay"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {reviews.lbReview.open && (
        <Lightbox
          images={reviews.lbReview.images}
          index={reviews.lbReview.index}
          onIndex={(i) => reviews.setLbReview((s) => ({ ...s, index: i }))}
          onClose={() => reviews.setLbReview({ open: false, images: [], index: 0 })}
        />
      )}
    </div>
  );
}
