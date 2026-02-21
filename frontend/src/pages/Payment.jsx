import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchBookingPayment } from "../api";
import { getPaymentStatusKey } from "../utils/labels";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";

const COUNTDOWN_MINUTES = 5;

function formatCountdown(secondsLeft) {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Payment() {
  const nav = useNavigate();
  const { id } = useParams();
  const { t } = useI18n();
  const { formatMoney } = useCurrency();
  const bookingId = Number(id);

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [countdownExpired, setCountdownExpired] = useState(false);
  const [endTimeMs, setEndTimeMs] = useState(null); // timestamp (ms) hết hạn, để timer chạy
  const [checkinGuideOpen, setCheckinGuideOpen] = useState(false);

  const phone = import.meta.env.VITE_CONTACT_PHONE || "0900000000";
  const zaloLink = import.meta.env.VITE_ZALO_LINK || `https://zalo.me/${String(phone).replace(/\s+/g, "")}`;

  const load = useCallback(async () => {
    try {
      const d = await fetchBookingPayment(bookingId);
      setData(d);
      setErr("");
      return d;
    } catch (e) {
      setErr(e.message || t("payment.err_load"));
      return null;
    }
  }, [bookingId, t]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // Lấy thời điểm hết hạn từ API hoặc 5 phút kể từ khi load trang
  useEffect(() => {
    if (!data?.booking) return;
    if (data.booking.status === "canceled") {
      setSecondsLeft(0);
      setCountdownExpired(true);
      return;
    }
    const raw = data.sepay?.expired_at || data.booking?.expires_at;
    if (raw) {
      setEndTimeMs(new Date(raw).getTime());
    } else {
      setEndTimeMs(Date.now() + COUNTDOWN_MINUTES * 60 * 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi thông tin hết hạn thay đổi
  }, [data?.booking?.id, data?.booking?.status, data?.sepay?.expired_at, data?.booking?.expires_at]);

  // Timer đếm ngược mỗi giây
  useEffect(() => {
    if (data?.booking?.status === "canceled" || !endTimeMs) return;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((endTimeMs - now) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        setCountdownExpired(true);
        load();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.booking?.status, endTimeMs, load]);

  // Khi countdown hết, gọi load để cập nhật trạng thái
  useEffect(() => {
    if (!countdownExpired || !data?.booking || data.booking.status === "canceled") return;
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần countdownExpired và load
  }, [countdownExpired, data?.booking?.status, load]);

  if (err) {
    return (
      <div className="container">
        <div className="card2">
          <div style={{ fontWeight: 900, color: "crimson" }}>{err}</div>
          <button className="btn btn-ghost" onClick={() => nav("/")}>
            {t("common.back_home")}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="container">{t("common.loading")}</div>;

  const { booking, sepay } = data;
  const isPending = booking?.status === "pending" && booking?.payment_status !== "paid";
  const showCountdown = isPending && secondsLeft !== null;
  const isPaymentSuccess = booking?.status === "confirmed" && (booking?.payment_status === "paid" || booking?.payment_status === "deposit_paid");

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>{t("payment.title")}</h1>
          <p>{t("payment.booking_id")} #{booking.id}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => nav("/")}>{t("common.home")}</button>
      </div>

      {isPaymentSuccess && (
        <div className="card2 payment-success-block" role="status" aria-live="polite">
          <div className="payment-success-check-wrap">
            <svg className="payment-success-check-svg" viewBox="0 0 80 80" aria-hidden="true">
              <circle className="payment-success-check-circle" cx="40" cy="40" r="36" strokeWidth="3" />
              <path className="payment-success-check-mark" d="M22 40 L35 53 L58 28" strokeWidth="3" />
            </svg>
          </div>
          <h2>{t("payment.success_title")}</h2>
          <p className="payment-success-msg">{t("payment.success_msg")}</p>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
            {t("payment.booking_id")} #{booking.id} • {t("payment.code")} {booking.lookup_code}
          </p>
          <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => setCheckinGuideOpen(true)}>
              {t("my_bookings.checkin_guide_btn")}
            </button>
            <button className="btn btn-ghost" onClick={() => nav("/booking-status")}>{t("common.search_booking")}</button>
            <button className="btn btn-ghost" onClick={() => nav("/my-bookings")}>{t("common.my_bookings")}</button>
          </div>
        </div>
      )}

      {checkinGuideOpen && (
        <div className="checkin-guide-overlay" onClick={() => setCheckinGuideOpen(false)}>
          <div className="checkin-guide-modal card2" onClick={(e) => e.stopPropagation()}>
            <h3 className="checkin-guide-modal__title">{t("my_bookings.checkin_guide_modal_title")}</h3>
            <p className="checkin-guide-modal__desc muted">{t("my_bookings.checkin_guide_content")}</p>
            <a href={zaloLink} target="_blank" rel="noreferrer" className="checkin-guide-modal__zalo btn">
              {t("my_bookings.checkin_guide_zalo_label")}
            </a>
            <div className="checkin-guide-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCheckinGuideOpen(false)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}

      {booking?.status === "canceled" && (
        <div className="card2 payment-expired" style={{ marginTop: 12, borderColor: "var(--danger, #dc2626)", background: "rgba(220, 38, 38, 0.08)" }}>
          <div style={{ fontWeight: 800, color: "var(--danger, #dc2626)", marginBottom: 8 }}>{t("payment.expired_title")}</div>
          <p className="muted" style={{ margin: 0 }}>{t("payment.expired_msg").replace("{min}", String(COUNTDOWN_MINUTES))}</p>
          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <button className="btn" onClick={() => nav("/")}>{t("common.back_home")}</button>
            <button className="btn btn-ghost" onClick={() => nav("/booking-status")}>{t("common.search_booking")}</button>
          </div>
        </div>
      )}

      {booking?.status !== "canceled" && (
      <>
      {!isPaymentSuccess && (
      <div className="card2" style={{ marginTop: 12 }}>
        <div><b>{t("payment.booking_id")}</b> #{booking.id}</div>
        <div><b>{t("payment.code")}</b> {booking.lookup_code}</div>
        <div><b>{t("payment.total")}</b> {formatMoney(booking?.total_amount ?? 0)}</div>
        {booking?.deposit_amount > 0 && (
          <>
            <div><b>{t("payment.deposit")}</b> {formatMoney(booking.deposit_amount)}</div>
            <div><b>{t("payment.paid")}</b> {formatMoney(booking?.paid_amount ?? 0)}</div>
            <div><b>{t("payment.status")}</b> {t(getPaymentStatusKey(booking?.payment_status))}</div>
          </>
        )}
      </div>
      )}

      {!isPaymentSuccess && sepay ? (
        <div className="card2 payment-sepay-card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>
            {booking?.payment_status === "deposit_paid" && sepay.remainder_amount > 0
              ? t("payment.pay_remainder")
              : t("payment.sepay_title")}
          </div>

          {showCountdown && (
            <div className="payment-countdown-inline" role="timer" aria-live="polite" aria-label={`${t("payment.time_left")}: ${secondsLeft !== null && secondsLeft > 0 ? formatCountdown(secondsLeft) : "0:00"}`}>
              <span className="payment-countdown-inline__label">{t("payment.time_left")}</span>
              <div className="payment-countdown-inline__value" data-low={secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 60}>
                {secondsLeft !== null && secondsLeft > 0 ? formatCountdown(secondsLeft) : "0:00"}
              </div>
              <span className="payment-countdown-inline__hint">{t("payment.expire_hint")}</span>
            </div>
          )}

          {booking?.payment_status === "deposit_paid" && sepay.remainder_amount > 0 && (
            <div className="muted" style={{ marginTop: 8 }}>
              {t("payment.you_paid_deposit")} <b>{formatMoney(sepay.remainder_amount)}</b>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <div><b>{t("payment.bank")}</b> {sepay.bank_name}</div>
            <div><b>{t("payment.bank_account")}</b> {sepay.bank_account}</div>
            {sepay.account_name && <div><b>{t("payment.account_name")}</b> {sepay.account_name}</div>}
            <div><b>{t("payment.transfer_content")}</b> {sepay.order_code}</div>
            <div><b>{t("payment.amount_to_transfer")}</b> {formatMoney(sepay.amount || 0)}</div>
            {booking?.remainder_payment_method === "cash" && booking?.payment_status === "deposit_paid" && (
              <div className="muted" style={{ marginTop: 8 }}>
                {t("payment.remainder_cash")}
              </div>
            )}
          </div>

          {sepay.qr_code_url && Number(sepay.amount || 0) > 0 && (
            <div className="pay-qr" style={{ marginTop: 12 }}>
              <img src={sepay.qr_code_url} alt={t("payment.qr_alt")} />
              <div className="muted" style={{ textAlign: "center", marginTop: 8 }}>
                {t("payment.scan_qr_msg")}
              </div>
            </div>
          )}
        </div>
      ) : !isPaymentSuccess ? (
        <div className="card2" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>{t("payment.cash_title")}</div>
          {showCountdown && (
            <div className="payment-countdown-inline" role="timer" aria-live="polite" aria-label={`${t("payment.time_left")}: ${secondsLeft !== null && secondsLeft > 0 ? formatCountdown(secondsLeft) : "0:00"}`}>
              <span className="payment-countdown-inline__label">{t("payment.time_left")}</span>
              <div className="payment-countdown-inline__value" data-low={secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 60}>
                {secondsLeft !== null && secondsLeft > 0 ? formatCountdown(secondsLeft) : "0:00"}
              </div>
              <span className="payment-countdown-inline__hint">{t("payment.expire_hint")}</span>
            </div>
          )}
          <div className="muted" style={{ marginTop: 6 }}>
            {t("payment.cash_status")} <b>{t(booking?.payment_status === "paid" ? "labels.payment_status_paid" : "labels.payment_status_unpaid")}</b>
          </div>
        </div>
      ) : null}

      {!isPaymentSuccess && (
      <div className="row" style={{ marginTop: 16, gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => nav("/booking-status")}>{t("common.search_booking")}</button>
        <button className="btn" onClick={() => nav("/my-bookings")}>{t("common.my_bookings")}</button>
      </div>
      )}
      </>
      )}
    </div>
  );
}
