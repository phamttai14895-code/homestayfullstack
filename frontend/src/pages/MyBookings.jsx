import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BASE, myBookings, createReview } from "../api";
import {
  bookingStatusClass,
  paymentStatusClass,
  getBookingStatusKey,
  getPaymentStatusKey,
  getPaymentMethodKey,
  getDisplayPaymentStatus
} from "../utils/labels";
import { fmtDDMMYYYYFromISO, nightsBetween } from "../utils/date";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";
import { useUser } from "../context/User.jsx";

function buildSepayQrUrl({ tpl, acc, bankName, amount, des }) {
  if (!tpl || !acc || !bankName || !amount) return "";
  return tpl
    .replaceAll("{ACC}", encodeURIComponent(acc))
    .replaceAll("{BANK}", encodeURIComponent(bankName))
    .replaceAll("{AMOUNT}", encodeURIComponent(String(amount)))
    .replaceAll("{DES}", encodeURIComponent(des || ""));
}

/** true nếu đã qua thời điểm check-out (ẩn nút hướng dẫn check-in) */
function isPastCheckout(b) {
  const now = new Date();
  const isHourly = String(b.booking_type || "").toLowerCase() === "hourly";
  if (isHourly && b.check_in && b.check_out_time) {
    const checkout = new Date(b.check_in + "T" + b.check_out_time);
    return now > checkout;
  }
  if (b.check_out) {
    const checkout = new Date(b.check_out + "T12:00:00");
    return now > checkout;
  }
  return false;
}

export default function MyBookings() {
  const nav = useNavigate();
  const { t } = useI18n();
  const { formatMoney } = useCurrency();
  const { me } = useUser();
  const [err, setErr] = useState("");
  const [bank, setBank] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all"); // all|pending|confirmed|canceled

  const [reviewModal, setReviewModal] = useState({ open: false, booking: null });
  const [reviewForm, setReviewForm] = useState({ stars: 5, comment: "" });
  const [reviewImages, setReviewImages] = useState([]); // File[]
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewErr, setReviewErr] = useState("");
  const [checkinGuideOpen, setCheckinGuideOpen] = useState(false);

  const phone = import.meta.env.VITE_CONTACT_PHONE || "0900000000";
  const zaloLink = import.meta.env.VITE_ZALO_LINK || `https://zalo.me/${String(phone).replace(/\s+/g, "")}`;

  // Chỉ load lại khi user đăng nhập/đổi (me?.id), tránh re-run khi refresh() cập nhật object me -> hết nháy "Đang tải..."
  useEffect(() => {
    async function load() {
      setErr("");
      if (!me) return;
      setLoading(true);
      try {
        const d = await myBookings();
        setBookings(Array.isArray(d.bookings) ? d.bookings : []);
        setBank(d.bank || null);
        window.dispatchEvent(new CustomEvent("user-updated"));
      } catch (e) {
        const msg = e?.message || "ERROR";
        setErr(msg === "UNAUTHORIZED" || msg === "LOGIN_REQUIRED"
          ? t("my_bookings.need_login_msg")
          : `${t("my_bookings.err_review_prefix")}: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [me?.id]);

  const byStatus = useMemo(() => {
    const map = { pending: 0, confirmed: 0, canceled: 0 };
    for (const b of bookings) {
      const s = b?.status;
      if (map[s] === undefined) map[s] = 0;
      map[s] += 1;
    }
    return map;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === "all") return bookings;
    return bookings.filter(b => b.status === statusFilter);
  }, [bookings, statusFilter]);

  if (!me) {
    return (
      <div className="container">
        <div className="header">
          <div className="brand">
            <h1>{t("my_bookings.title")}</h1>
            <p>{t("my_bookings.intro")}</p>
          </div>
          <button className="btn btn-ghost" onClick={() => nav("/")}>{t("common.home")}</button>
        </div>

        <div className="card2">
          <div style={{ fontWeight: 950 }}>{t("my_bookings.not_logged_in")}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {t("my_bookings.login_to_see")}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn btn-sm" href={`${BASE}/auth/google`}>{t("common.login_google")}</a>
            <Link className="btn btn-ghost btn-sm" to="/booking-status">{t("common.search")}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>{t("my_bookings.title")}</h1>
          <p>{me.name || me.email}</p>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => nav("/")}>{t("common.home")}</button>
          <Link className="btn btn-ghost" to="/booking-status">{t("common.search")}</Link>
        </div>
      </div>

      {err && <p className="error-message">{err}</p>}

      {/* ✅ Tổng quan + click để lọc */}
      <div className="card2" style={{ marginBottom: 14 }}>
        <div style={{
          fontWeight: 950,
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap"
        }}>
          <span>{t("my_bookings.overview")}</span>
          <div className="row">
            {loading && <span className="muted" style={{ fontWeight: 900 }}>{t("my_bookings.loading")}</span>}
            {statusFilter !== "all" && (
              <button className="btn btn-ghost btn-sm" onClick={() => setStatusFilter("all")}>
                {t("my_bookings.clear_filter")}
              </button>
            )}
          </div>
        </div>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <button
            type="button"
            className={`badge pending ${statusFilter === "pending" ? "on" : ""}`}
            onClick={() => setStatusFilter(s => (s === "pending" ? "all" : "pending"))}
            style={{ border: "none", cursor: "pointer" }}
            title={t("my_bookings.filter_pending")}
          >
            {t(getBookingStatusKey("pending"))}: {byStatus.pending || 0}
          </button>

          <button
            type="button"
            className={`badge confirmed ${statusFilter === "confirmed" ? "on" : ""}`}
            onClick={() => setStatusFilter(s => (s === "confirmed" ? "all" : "confirmed"))}
            style={{ border: "none", cursor: "pointer" }}
            title={t("my_bookings.filter_confirmed")}
          >
            {t(getBookingStatusKey("confirmed"))}: {byStatus.confirmed || 0}
          </button>

          <button
            type="button"
            className={`badge canceled ${statusFilter === "canceled" ? "on" : ""}`}
            onClick={() => setStatusFilter(s => (s === "canceled" ? "all" : "canceled"))}
            style={{ border: "none", cursor: "pointer" }}
            title={t("my_bookings.filter_canceled")}
          >
            {t(getBookingStatusKey("canceled"))}: {byStatus.canceled || 0}
          </button>
        </div>

        <div className="muted" style={{ marginTop: 8 }}>
          {t("my_bookings.showing")} <b>{filteredBookings.length}</b> / {bookings.length}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {filteredBookings.map((b) => {
          const isHourly = String(b.booking_type || "").toLowerCase() === "hourly";
          let nights;
          let pricePerNight;
          if (isHourly) {
            const t1 = b.check_in_time, t2 = b.check_out_time;
            if (t1 && t2) {
              const [h1, m1] = t1.split(":").map(Number);
              const [h2, m2] = t2.split(":").map(Number);
              nights = Math.max(0.5, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
            } else nights = 1;
            pricePerNight = Number(b.price_per_hour ?? b.room_price_per_hour ?? 0);
          } else {
            nights = Math.max(1, nightsBetween(b.check_in, b.check_out));
            pricePerNight = Number(
              b.price_per_night ?? b.room_price_per_night ?? b.room_price ?? b.price ?? 0
            );
          }

          const total =
            Number(b.total_amount || 0) > 0
              ? Number(b.total_amount)
              : (nights * pricePerNight);

          const paid = Number(b.paid_amount || 0);
          const depositAmount = Number(b.deposit_amount || 0);
          const remainder = Math.max(0, total - paid);
          // Số tiền cọc cần chuyển (giống lúc đặt phòng / trang thanh toán): cọc hoặc hết
          const amountToPay = depositAmount > 0 ? depositAmount : total;

          // ✅ Nội dung chuyển khoản: ưu tiên sepay_order_code (chuẩn auto confirm), fallback lookup_code
          const transferContent = b.sepay_order_code || b.lookup_code || `B${b.id}`;

          // ✅ QR: số tiền cọc (giống lúc đặt), ưu tiên sepay_qr_url từ backend, fallback build từ bank
          const qrUrl =
            b.payment_method === "sepay" && amountToPay > 0
              ? (b.sepay_qr_url || (bank ? buildSepayQrUrl({
                  tpl: bank.qr_url_template,
                  acc: bank.account_number,
                  bankName: bank.bank_name,
                  amount: amountToPay,
                  des: transferContent
                }) : ""))
              : "";

          return (
            <div key={b.id} className="card2">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 16 }}>
                    <b>#{b.id}</b> • <span className="badge">{b.lookup_code}</span>{" "}
                    • <span className={bookingStatusClass(b.status)}>{t(getBookingStatusKey(b.status))}</span>{" "}
                    • <span className={paymentStatusClass(getDisplayPaymentStatus(b))}>{t(getPaymentStatusKey(getDisplayPaymentStatus(b)))}</span>
                  </div>

                  <div className="muted" style={{ marginTop: 4 }}>
                    {b.room_name} {b.room_location ? `• ${b.room_location}` : ""}
                  </div>

                  <div className="muted" style={{ marginTop: 4 }}>
                    {isHourly ? (
                      <>{fmtDDMMYYYYFromISO(b.check_in)} {b.check_in_time}-{b.check_out_time} • {b.guests} {t("my_bookings.guests")} • {nights} {t("my_bookings.hours")}</>
                    ) : (
                      <>{fmtDDMMYYYYFromISO(b.check_in)} → {fmtDDMMYYYYFromISO(b.check_out)} • {b.guests} {t("my_bookings.guests")} • {nights} {t("my_bookings.nights")}</>
                    )}
                  </div>

                  <div className="muted" style={{ marginTop: 4 }}>
                    {t("my_bookings.total")} <b>{formatMoney(Number(total || 0))}</b>
                    {pricePerNight > 0 && (
                      <> • {nights} × {formatMoney(pricePerNight)}{isHourly ? `/${t("common.per_hour")}` : ""}</>
                    )}
                    {" "}• {t("my_bookings.method_label")} <b>{t(getPaymentMethodKey(b.payment_method))}</b>
                  </div>
                  {b.payment_method === "sepay" && (
                    <div className="muted" style={{ marginTop: 6 }}>
                      {t("my_bookings.deposit_paid")} <b>{formatMoney(paid)}</b>
                      {" "}• {t("my_bookings.remainder")} <b>{formatMoney(remainder)}</b>
                    </div>
                  )}
                </div>

                <div className="badges" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {b.can_review && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setReviewForm({ stars: 5, comment: "" });
                        setReviewImages([]);
                        setReviewErr("");
                        setReviewModal({ open: true, booking: b });
                      }}>
                      {t("my_bookings.review_btn")}
                    </button>
                  )}
                  {b.has_review && (
                    <span className="muted" style={{ fontSize: 12 }}>{t("my_bookings.reviewed")}</span>
                  )}
                  {b.status === "confirmed" && !isPastCheckout(b) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCheckinGuideOpen(true)}
                    >
                      {t("my_bookings.checkin_guide_btn")}
                    </button>
                  )}
                  <Link className="btn btn-ghost btn-sm" to="/booking-status">{t("common.search")}</Link>
                </div>
              </div>

              {b.payment_method === "cash" ? (
                <div className="card2 pay-summary-card" style={{ marginTop: 12 }}>
                  <div className="pay-summary-title">{t("my_bookings.cash_section_title")}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {t("my_bookings.payment_status_label")} <b>{t(getPaymentStatusKey(getDisplayPaymentStatus(b)))}</b>
                  </div>
                </div>
              ) : (
                <div className="card2 pay-summary-card" style={{ marginTop: 12 }}>
                  <div className="pay-summary-title">{t("my_bookings.sepay_section_title")}</div>

                  {b.status === "canceled" ? (
                    <div className="muted" style={{ marginTop: 8 }}>
                      {t("my_bookings.canceled_hide")}
                    </div>
                  ) : b.status === "confirmed" ? (
                    <div className="muted" style={{ marginTop: 8 }}>
                      {t("my_bookings.completed")}
                    </div>
                  ) : getDisplayPaymentStatus(b) === "paid" ? (
                    <div className="muted" style={{ marginTop: 8 }}>
                      {t("my_bookings.paid_success_msg")} <b>{t(getPaymentStatusKey(getDisplayPaymentStatus(b)))}</b>
                    </div>
                  ) : (
                    <>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {t("my_bookings.transfer_content_label")} <b>{transferContent}</b>
                      </div>

                      <div className="muted" style={{ marginTop: 6 }}>
                        {depositAmount > 0 ? (
                          <>{t("my_bookings.amount_to_transfer_deposit")} <b>{formatMoney(amountToPay)}</b></>
                        ) : (
                          <>{t("my_bookings.amount_to_transfer")} <b>{formatMoney(amountToPay)}</b></>
                        )}
                      </div>

                      {bank ? (
                        <div className="row2" style={{ marginTop: 10 }}>
                          <div>
                            <div className="muted">{t("booking_status.bank")}</div>
                            <div style={{ fontWeight: 950 }}>{bank.bank_name}</div>
                          </div>
                          <div>
                            <div className="muted">{t("booking_status.account_holder")}</div>
                            <div style={{ fontWeight: 950 }}>{bank.account_name || "—"}</div>
                          </div>
                          <div>
                            <div className="muted">{t("booking_status.account_number")}</div>
                            <div style={{ fontWeight: 950 }}>{bank.account_number}</div>
                          </div>
                          <div>
                            <div className="muted">{t("booking_status.payment_status")}</div>
                            <div style={{ fontWeight: 950 }}>
                              {t(getPaymentStatusKey(getDisplayPaymentStatus(b)))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="muted" style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
                          {t("my_bookings.backend_no_bank")}
                        </div>
                      )}

                      {!!qrUrl && (
                        <div className="pay-qr" style={{ marginTop: 12 }}>
                          <img src={qrUrl} alt="SePay QR" />
                          <div className="muted" style={{ textAlign: "center" }}>
                            {t("my_bookings.scan_qr")}
                          </div>
                        </div>
                      )}

                      {!qrUrl && (
                        <div className="muted" style={{ marginTop: 10, color: "#b45309", fontWeight: 900 }}>
                          {t("my_bookings.no_qr_msg")}
                        </div>
                      )}

                      {amountToPay <= 0 && (
                        <div className="muted" style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
                          {t("my_bookings.no_amount")}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!filteredBookings.length && (
          <div className="card2">
            <div style={{ fontWeight: 950 }}>
              {statusFilter === "all" ? t("my_bookings.no_bookings") : t("my_bookings.no_bookings_filter")}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              {statusFilter === "all"
                ? t("my_bookings.no_bookings_msg")
                : t("my_bookings.filter_hint")}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => nav("/")}>{t("my_bookings.view_rooms")}</button>
              {statusFilter !== "all" && (
                <button className="btn btn-ghost" onClick={() => setStatusFilter("all")}>{t("my_bookings.clear_filter")}</button>
              )}
            </div>
          </div>
        )}
      </div>

      {reviewModal.open && reviewModal.booking && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => !reviewSubmitting && setReviewModal({ open: false, booking: null })}
        >
          <div
            className="card2"
            style={{ maxWidth: 420, width: "90%", margin: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 950, marginBottom: 8 }}>{t("my_bookings.review_modal_title")}</div>
            <div className="muted" style={{ marginBottom: 12 }}>
              {reviewModal.booking.room_name} • #{reviewModal.booking.id}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="muted" style={{ marginBottom: 6 }}>{t("my_bookings.stars_label")}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 24,
                      cursor: "pointer",
                      padding: 4,
                      lineHeight: 1
                    }}
                    onClick={() => setReviewForm((f) => ({ ...f, stars: n }))}
                  >
                    {n <= (reviewForm.stars || 5) ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="muted" style={{ display: "block", marginBottom: 6 }}>{t("my_bookings.comment_optional")}</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder={t("my_bookings.comment_placeholder")}
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                  resize: "vertical"
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="muted" style={{ display: "block", marginBottom: 6 }}>{t("my_bookings.upload_review_images")}</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("my_bookings.upload_review_hint")}</p>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ fontSize: 14 }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setReviewImages((prev) => prev.concat(files).slice(0, 6));
                  e.target.value = "";
                }}
              />
              {reviewImages.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {reviewImages.map((file, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt=""
                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                      <button
                        type="button"
                        aria-label={t("my_bookings.remove_image_aria")}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: "none",
                          background: "var(--danger)",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: 14,
                          lineHeight: 1,
                          padding: 0
                        }}
                        onClick={() => setReviewImages((p) => p.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {reviewErr && <p className="error-message" style={{ fontSize: 14, marginBottom: 8 }}>{reviewErr}</p>}
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={reviewSubmitting}
                onClick={() => {
                  setReviewModal({ open: false, booking: null });
                  setReviewForm({ stars: 5, comment: "" });
                  setReviewImages([]);
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn"
                disabled={reviewSubmitting}
                onClick={async () => {
                  setReviewErr("");
                  setReviewSubmitting(true);
                  try {
                    await createReview(reviewModal.booking.id, reviewForm.stars, reviewForm.comment, reviewImages);
                    setReviewModal({ open: false, booking: null });
                    setReviewForm({ stars: 5, comment: "" });
                    setReviewImages([]);
                    const d = await myBookings();
                    setBookings(Array.isArray(d.bookings) ? d.bookings : []);
                    window.dispatchEvent(new CustomEvent("user-updated"));
                  } catch (e) {
                    const msg = e?.message || t("my_bookings.err_review_prefix");
                    setReviewErr(msg === "AFTER_CHECKOUT_ONLY" ? t("my_bookings.review_after_checkout") : msg);
                  } finally {
                    setReviewSubmitting(false);
                  }
                }}
              >
                {reviewSubmitting ? t("my_bookings.submitting_review") : t("my_bookings.submit_review")}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkinGuideOpen && (
        <div
          className="checkin-guide-overlay"
          onClick={() => setCheckinGuideOpen(false)}
        >
          <div
            className="checkin-guide-modal card2"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="checkin-guide-modal__title">{t("my_bookings.checkin_guide_modal_title")}</h3>
            <p className="checkin-guide-modal__desc muted">
              {t("my_bookings.checkin_guide_content")}
            </p>
            <a
              href={zaloLink}
              target="_blank"
              rel="noreferrer"
              className="checkin-guide-modal__zalo btn"
            >
              {t("my_bookings.checkin_guide_zalo_label")}
            </a>
            <div className="checkin-guide-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCheckinGuideOpen(false)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
