import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { bookingSearch, fetchRoomDetail } from "../api";
import {
  bookingStatusClass,
  paymentStatusClass,
  getBookingStatusKey,
  getPaymentStatusKey,
  getPaymentMethodKey,
  getDisplayPaymentStatus
} from "../utils/labels";
import { fmtDDMMYYYYFromISO, nightsBetween } from "../utils/date";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";

function norm(s) { return String(s || "").trim(); }
function upper(s) { return norm(s).toUpperCase(); }
function isDigits(s) { return /^[0-9]+$/.test(norm(s)); }
function looksEmail(s) { return norm(s).includes("@"); }

export default function BookingStatus() {
  const nav = useNavigate();
  const { t } = useI18n();
  const { formatMoney } = useCurrency();

  const [mode, setMode] = useState("code"); // code | id | phone_email
  const [code, setCode] = useState("");
  const [id, setId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // normalized: { booking, room, bank }
  const [result, setResult] = useState(null);

  usePageTitle("Tra cứu đặt phòng — Homestay");

  // params đúng backend: code | id | phone + email
  const params = useMemo(() => {
    if (mode === "code") return { code: upper(code) };
    if (mode === "id") return { id: norm(id) };
    return { phone: norm(phone), email: norm(email) };
  }, [mode, code, id, phone, email]);

  const canSearch = useMemo(() => {
    if (mode === "code") return upper(code).length >= 4;
    if (mode === "id") return isDigits(id);
    return norm(phone).length >= 8 && looksEmail(email);
  }, [mode, code, id, phone, email]);

  const bank = result?.bank || null;
  const items = result?.bookings?.length
    ? result.bookings
    : result?.booking
      ? [{ booking: result.booking, room: result.room }]
      : [];

  function getNights(b) {
    if (!b) return 0;
    const isH = String(b.booking_type || "").toLowerCase() === "hourly";
    if (isH) {
      const t1 = b.check_in_time, t2 = b.check_out_time;
      if (!t1 || !t2) return 0;
      const [h1, m1] = t1.split(":").map(Number);
      const [h2, m2] = t2.split(":").map(Number);
      return Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * 10) / 10;
    }
    return nightsBetween(b.check_in, b.check_out);
  }

  function getTotal(b, r) {
    if (!b) return 0;
    const t = Number(b.total_amount || 0);
    if (t > 0) return t;
    const isH = String(b.booking_type || "").toLowerCase() === "hourly";
    const nights = getNights(b);
    if (r) return isH ? nights * Number(r.price_per_hour || 0) : nights * Number(r.price_per_night || 0);
    return 0;
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setResult(null);

    if (!canSearch) {
      setErr(t("booking_status.err_required"));
      return;
    }

    setLoading(true);
    try {
      // clean params
      const clean = {};
      Object.entries(params).forEach(([k, v]) => { if (v) clean[k] = v; });

      const d = await bookingSearch(clean);

      // Backend trả { booking } (code/id) hoặc { bookings } (phone+email - 3 kết quả gần nhất)
      const booking = d?.booking || null;
      const bookings = d?.bookings || null;

      if (bookings && bookings.length > 0) {
        // phone+email: nhiều kết quả
        const items = bookings.map(b => ({
          booking: b,
          room: b.room_name ? { name: b.room_name, location: b.room_location, price_per_night: b.price_per_night, price_per_hour: b.price_per_hour } : null
        }));
        setResult({ bookings: items, bank: d?.bank || null });
      } else if (booking) {
        // code/id: 1 kết quả
        let room = d?.room || null;
        if (!room && booking.room_id) {
          try {
            const rr = await fetchRoomDetail(Number(booking.room_id));
            room = rr?.room || null;
          } catch {
            // ignore
          }
        }
        setResult({ booking, room, bank: d?.bank || null });
      } else {
        setErr(t("booking_status.err_not_found"));
      }
    } catch (e2) {
      const msg = e2?.message || "ERROR";
      if (msg === "NOT_FOUND") setErr(t("booking_status.err_not_found_check"));
      else if (msg === "MISSING_QUERY") setErr(t("booking_status.err_missing_query"));
      else setErr(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function onChangeMode(next) {
    setMode(next);
    setErr("");
    setResult(null);
    // optional: clear inputs khi đổi mode để tránh nhầm
    // setCode(""); setId(""); setPhone(""); setEmail("");
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>{t("booking_status.title")}</h1>
          <p>{t("booking_status.subtitle")}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => nav("/")}>{t("common.home")}</button>
      </div>

      <div className="card2">
        <div style={{ fontWeight: 950, marginBottom: 10 }}>{t("booking_status.choose_mode")}</div>

        <div className="chips" style={{ marginBottom: 10 }}>
          <button type="button" className={`chip ${mode === "code" ? "on" : ""}`} onClick={() => onChangeMode("code")}>
            {t("booking_status.code")}
          </button>
          <button type="button" className={`chip ${mode === "id" ? "on" : ""}`} onClick={() => onChangeMode("id")}>
            {t("booking_status.id")}
          </button>
          <button type="button" className={`chip ${mode === "phone_email" ? "on" : ""}`} onClick={() => onChangeMode("phone_email")}>
            {t("booking_status.phone_email")}
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          {mode === "code" && (
            <div className="input">
              <label>{t("booking_status.label_code")}</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="NVH-ABC123"
                autoCapitalize="characters"
              />
            </div>
          )}

          {mode === "id" && (
            <div className="input">
              <label>{t("booking_status.label_id")}</label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="12"
                inputMode="numeric"
              />
            </div>
          )}

          {mode === "phone_email" && (
            <div className="row2">
              <div className="input">
                <label>{t("booking_status.label_phone")}</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09..."
                  inputMode="tel"
                />
              </div>
              <div className="input">
                <label>{t("booking_status.label_email")}</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="a@b.com"
                  inputMode="email"
                />
              </div>
            </div>
          )}

          <div className="row">
            <button className="btn btn-sm" type="submit" disabled={!canSearch || loading}>
              {loading ? t("booking_status.searching") : t("booking_status.search_btn")}
            </button>
            <div className="muted" style={{ fontWeight: 900 }}>
              {t("booking_status.hint")}
            </div>
          </div>

          {err && <div className="error-message">{err}</div>}
        </form>
      </div>

      {items.map(({ booking: b, room: r }, idx) => {
        const isHourly = String(b?.booking_type || "").toLowerCase() === "hourly";
        const nights = getNights(b);
        const total = getTotal(b, r);
        const transferContent = b?.sepay_order_code || b?.lookup_code || `B${b?.id}`;
        const qrUrl = String(b?.payment_method || "").toLowerCase() === "sepay" ? (b?.sepay_qr_url || "") : "";

        return (
          <div key={b.id} className="card2" style={{ marginTop: idx === 0 ? 14 : 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>
                  Booking <b>#{b.id}</b> • <span className="badge">{b.lookup_code}</span>
                </div>

                <div className="muted" style={{ marginTop: 4 }}>
                  {r ? `${r.name} • ${r.location}` : (b.room_name ? `${b.room_name}` : t("booking_status.loading_room"))}
                </div>

                <div className="muted" style={{ marginTop: 4 }}>
                  {isHourly ? (
                    <>{fmtDDMMYYYYFromISO(b.check_in)} {b.check_in_time}-{b.check_out_time} • {b.guests} {t("my_bookings.guests")} • {nights} {t("booking_status.hours")}</>
                  ) : (
                    <>{fmtDDMMYYYYFromISO(b.check_in)} → {fmtDDMMYYYYFromISO(b.check_out)} • {b.guests} {t("my_bookings.guests")}</>
                  )}
                </div>
              </div>

              <div className="badges">
                <span className={bookingStatusClass(b.status)}>{t(getBookingStatusKey(b.status))}</span>
                <span className={paymentStatusClass(getDisplayPaymentStatus(b))}>{t(getPaymentStatusKey(getDisplayPaymentStatus(b)))}</span>
              </div>
            </div>

            <div className="card2 pay-summary-card" style={{ marginTop: 12 }}>
              <div className="row2">
                <div>
                  <div className="muted">{isHourly ? t("booking_status.price_per_hour") : t("booking_status.price_per_night")}</div>
                  <div style={{ fontWeight: 950 }}>
                    {formatMoney(isHourly ? (r?.price_per_hour ?? 0) : (r?.price_per_night ?? b?.price_per_night ?? 0) || 0)}
                  </div>
                </div>
                <div>
                  <div className="muted">{isHourly ? t("booking_status.hours") : t("booking_status.nights")}</div>
                  <div style={{ fontWeight: 950 }}>{nights}</div>
                </div>
                <div>
                  <div className="muted">{t("booking_status.total")}</div>
                  <div style={{ fontWeight: 950 }}>{formatMoney(total || 0)}</div>
                </div>
                <div>
                  <div className="muted">{t("booking_status.method")}</div>
                  <div style={{ fontWeight: 950 }}>{t(getPaymentMethodKey(b.payment_method))}</div>
                </div>
              </div>
            </div>

            {String(b.status || "").toLowerCase() !== "canceled" && (
              (() => {
                const displayStatus = getDisplayPaymentStatus(b);
                const isFullyPaidAndConfirmed = String(b.status || "").toLowerCase() === "confirmed" && displayStatus === "paid";
                if (String(b.payment_method || "").toLowerCase() === "cash") {
                  return (
                    <div className="card2 pay-summary-card" style={{ marginTop: 12 }}>
                      <div className="pay-summary-title">{t("booking_status.pay_cash_at_room")}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {t("booking_status.payment_status")} <b>{t(getPaymentStatusKey(displayStatus))}</b>
                      </div>
                    </div>
                  );
                }
                if (isFullyPaidAndConfirmed) {
                  return (
                    <div className="card2 pay-summary-card" style={{ marginTop: 12 }}>
                      <div className="pay-summary-title">{t("booking_status.pay_transfer")}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {t("booking_status.payment_status")} <b style={{ color: "green" }}>{t(getPaymentStatusKey(displayStatus))}</b>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="card2 pay-summary-card" style={{ marginTop: 12 }}>
                    <div className="pay-summary-title">{t("booking_status.pay_transfer")}</div>

                    <div className="muted" style={{ marginTop: 6 }}>
                      {t("booking_status.transfer_content")} <b>{transferContent}</b>
                    </div>

                    <div className="muted" style={{ marginTop: 6 }}>
                      {t("booking_status.amount")} <b>{formatMoney(total || 0)}</b>
                    </div>

                    {bank && (
                      <div style={{ marginTop: 10 }} className="row2">
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
                      </div>
                    )}

                    {qrUrl ? (
                      <div className="pay-qr" style={{ marginTop: 12 }}>
                        <img src={qrUrl} alt="SePay QR" />
                        <div className="muted" style={{ textAlign: "center" }}>
                          {t("booking_status.scan_qr")}
                        </div>
                      </div>
                    ) : (
                      <div className="muted" style={{ marginTop: 10 }}>
                        {t("booking_status.no_qr")}
                      </div>
                    )}

                    <div className="muted" style={{ marginTop: 10 }}>
                      {t("booking_status.payment_status")}{" "}
                      <b style={{ color: displayStatus === "paid" ? "green" : "#b45309" }}>
                        {t(getPaymentStatusKey(displayStatus))}
                      </b>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        );
      })}
    </div>
  );
}
