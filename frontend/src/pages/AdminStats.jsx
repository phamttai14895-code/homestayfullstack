import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  fetchAdminStats,
  fetchAdminStatsWeekDetail,
  adminGetBooking,
  adminSetBookingStatus,
  adminSetBookingPayment,
  adminDeleteBooking
} from "../api";
import {
  bookingStatusLabel,
  bookingStatusClass,
  paymentStatusLabel,
  paymentStatusClass,
  paymentMethodLabel,
  getDisplayPaymentStatus
} from "../utils/labels";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";

/** Format YYYY-MM-DD thành dd-mm-yyyy. */
function formatDDMMYYYY(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

/** Format Date sang YYYY-MM-DD dùng múi giờ local (tránh lỗi timezone). */
function toLocalYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lấy thứ Hai của tuần chứa ngày d. */
function getMondayOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toLocalYYYYMMDD(date);
}

/** Lấy Chủ Nhật của tuần chứa ngày d. */
function getSundayOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + diff);
  return toLocalYYYYMMDD(date);
}

const PRESETS = {
  this_week: (now) => ({ from: getMondayOfWeek(now), to: getSundayOfWeek(now) }),
  last_week: (now) => {
    const lastMon = new Date(now); lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(lastMon); lastSun.setDate(lastSun.getDate() + 6);
    return { from: toLocalYYYYMMDD(lastMon), to: toLocalYYYYMMDD(lastSun) };
  },
  "4_weeks": (now) => {
    const from = new Date(now); from.setDate(from.getDate() - 27);
    return { from: getMondayOfWeek(from), to: getSundayOfWeek(now) };
  },
  "12_weeks": (now) => {
    const from = new Date(now); from.setDate(from.getDate() - 83);
    return { from: getMondayOfWeek(from), to: getSundayOfWeek(now) };
  }
};

export default function AdminStats() {
  const { t } = useI18n();
  const { formatMoney } = useCurrency();
  usePageTitle(t("admin.stats_title") + " — Admin");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const now = useMemo(() => new Date(), []);
  const defaultRange = useMemo(() => PRESETS["12_weeks"](now), [now]);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [showCustom, setShowCustom] = useState(false);
  const [detailWeek, setDetailWeek] = useState(null);
  const [detailBookings, setDetailBookings] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBooking, setDetailBooking] = useState(null);
  const [detailBookingLoading, setDetailBookingLoading] = useState(false);

  useEffect(() => {
    setData(null);
    setErr("");
    fetchAdminStats(dateFrom, dateTo)
      .then(setData)
      .catch((e) => setErr(e?.message || t("admin.err_stats")));
  }, [dateFrom, dateTo, t]);

  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  const applyPreset = (key) => {
    const range = PRESETS[key](new Date());
    setDateFrom(range.from);
    setDateTo(range.to);
    setShowCustom(false);
  };

  const openCustom = () => {
    setCustomFrom(dateFrom);
    setCustomTo(dateTo);
    setShowCustom(true);
  };

  const applyCustom = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setDateFrom(customFrom);
      setDateTo(customTo);
      setShowCustom(false);
    }
  };

  const openWeekDetail = (r) => {
    setDetailWeek({ weekLabel: r.weekLabel, weekStart: r.weekStart, weekEnd: r.weekEnd });
    setDetailBookings([]);
    setDetailLoading(true);
    fetchAdminStatsWeekDetail(r.weekStart)
      .then((d) => setDetailBookings(d.bookings || []))
      .catch(() => setDetailBookings([]))
      .finally(() => setDetailLoading(false));
  };

  const closeWeekDetail = () => {
    setDetailWeek(null);
    setDetailBooking(null);
  };

  const refreshWeekDetail = () => {
    if (detailWeek?.weekStart) {
      fetchAdminStatsWeekDetail(detailWeek.weekStart)
        .then((d) => setDetailBookings(d.bookings || []))
        .catch(() => setDetailBookings([]));
    }
  };

  const openBookingDetail = (b) => {
    setDetailBooking(null);
    setDetailBookingLoading(true);
    adminGetBooking(b.id)
      .then((d) => setDetailBooking(d.booking || null))
      .catch(() => setDetailBooking(null))
      .finally(() => setDetailBookingLoading(false));
  };

  const closeBookingDetail = () => setDetailBooking(null);

  const handleSetStatus = async (id, status) => {
    try {
      await adminSetBookingStatus(id, status);
      closeBookingDetail();
      refreshWeekDetail();
      if (data) fetchAdminStats(dateFrom, dateTo).then(setData);
    } catch (e) {
      alert(e?.message || "Lỗi");
    }
  };

  const handleMarkPaid = async (b) => {
    try {
      await adminSetBookingPayment(b.id, "paid", Number(b.total_amount || 0));
      closeBookingDetail();
      refreshWeekDetail();
      if (data) fetchAdminStats(dateFrom, dateTo).then(setData);
    } catch (e) {
      alert(e?.message || "Lỗi");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t("admin.stats_confirm_delete") || "Xóa đơn này?")) return;
    try {
      await adminDeleteBooking(id);
      closeBookingDetail();
      refreshWeekDetail();
      if (data) fetchAdminStats(dateFrom, dateTo).then(setData);
    } catch (e) {
      alert(e?.message || "Lỗi");
    }
  };

  /** Preset đang chọn (để highlight nút). */
  const activePreset = useMemo(() => {
    const n = new Date();
    for (const key of ["this_week", "last_week", "4_weeks", "12_weeks"]) {
      const r = PRESETS[key](n);
      if (r.from === dateFrom && r.to === dateTo) return key;
    }
    return "custom";
  }, [dateFrom, dateTo]);

  if (err) {
    return (
      <div className="container">
        <div className="header">
          <Link className="btn btn-ghost" to="/admin">{t("admin.admin_back")}</Link>
        </div>
        <p className="error-message">{err}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container">
        <div className="header">
          <Link className="btn btn-ghost" to="/admin">{t("admin.admin_back")}</Link>
        </div>
        <div className="muted">{t("common.loading_stats")}</div>
      </div>
    );
  }

  const {
    totalBookings,
    totalRevenue,
    revenueByWeek = [],
    occupancyRate,
    totalRoomNights,
    maxRoomNights,
    numRooms = 0,
    periodStartFormatted = "",
    periodEndFormatted = ""
  } = data;

  const chartData = revenueByWeek;
  const maxChartRev = chartData.length ? Math.max(1, ...chartData.map((r) => r.revenue)) : 1;
  const finalStart = periodStartFormatted || formatDDMMYYYY(data.periodStart) || "—";
  const finalEnd = periodEndFormatted || formatDDMMYYYY(data.periodEnd) || "—";

  return (
    <div className="container stats-page">
      <header className="stats-header">
        <div className="brand">
          <h1>{t("admin.stats_title")}</h1>
          <p className="stats-period muted">
            {finalStart} – {finalEnd} · {Number(numRooms)} {t("admin.rooms_count")}
          </p>
        </div>
        <div className="stats-header-actions">
          <div className="stats-range-picker">
            <span className="stats-range-label muted">{t("admin.stats_range_label")}</span>
            <div className="stats-range-presets">
              <button
                type="button"
                className={`stats-range-preset-btn ${activePreset === "this_week" ? "stats-range-preset-btn--active" : ""}`}
                onClick={() => applyPreset("this_week")}
              >
                {t("admin.stats_range_this_week")}
              </button>
              <button
                type="button"
                className={`stats-range-preset-btn ${activePreset === "last_week" ? "stats-range-preset-btn--active" : ""}`}
                onClick={() => applyPreset("last_week")}
              >
                {t("admin.stats_range_last_week")}
              </button>
              <button
                type="button"
                className={`stats-range-preset-btn ${activePreset === "4_weeks" ? "stats-range-preset-btn--active" : ""}`}
                onClick={() => applyPreset("4_weeks")}
              >
                {t("admin.stats_range_4_weeks")}
              </button>
              <button
                type="button"
                className={`stats-range-preset-btn ${activePreset === "12_weeks" ? "stats-range-preset-btn--active" : ""}`}
                onClick={() => applyPreset("12_weeks")}
              >
                {t("admin.stats_range_12_weeks")}
              </button>
              <button
                type="button"
                className={`stats-range-preset-btn ${activePreset === "custom" ? "stats-range-preset-btn--active" : ""}`}
                onClick={openCustom}
              >
                {t("admin.stats_range_custom")}
              </button>
            </div>
            {showCustom && (
              <div className="stats-range-custom">
                <label>
                  <span className="muted">{t("admin.stats_range_from")}</span>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </label>
                <label>
                  <span className="muted">{t("admin.stats_range_to")}</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </label>
                <button type="button" className="btn btn-sm" onClick={applyCustom}>
                  {t("admin.stats_range_apply")}
                </button>
              </div>
            )}
          </div>
          <Link className="btn btn-ghost" to="/admin">{t("admin.admin_back")}</Link>
        </div>
      </header>

      <section className="stats-cards">
        <div className="card2 stats-card">
          <div className="stats-card-label">{t("admin.total_bookings")}</div>
          <div className="stats-card-value">{Number(totalBookings || 0).toLocaleString()}</div>
          <div className="stats-card-hint muted">{t("admin.stats_booking_hint_all")}</div>
        </div>
        <div className="card2 stats-card stats-card-revenue">
          <div className="stats-card-label">{t("admin.stats_revenue_label")}</div>
          <div className="stats-card-value">{formatMoney(Number(totalRevenue || 0))}</div>
          <div className="stats-card-hint muted">{t("admin.stats_revenue_hint_all")}</div>
        </div>
        <div className="card2 stats-card stats-card-discount">
          <div className="stats-card-label">{t("admin.stats_discount_label")}</div>
          <div className="stats-card-value">{formatMoney(Math.round(Number(totalRevenue || 0) * 0.1))}</div>
          <div className="stats-card-hint muted">{t("admin.stats_discount_hint")}</div>
        </div>
        <div className="card2 stats-card stats-card-occupancy">
          <div className="stats-card-label">{t("admin.stats_occupancy_label")}</div>
          <div className="stats-card-value">{Number(occupancyRate || 0)}%</div>
          <div className="stats-card-hint muted">{t("admin.stats_occupancy_hint").replace("{nights}", totalRoomNights).replace("{max}", maxRoomNights)}</div>
        </div>
      </section>

      <section className="card2 stats-section">
        <h2 className="stats-section-title">{t("admin.stats_section_by_week")}</h2>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{t("admin.stats_table_week")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.stats_table_orders")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.stats_table_revenue")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.stats_table_discount")}</th>
              </tr>
            </thead>
            <tbody>
              {revenueByWeek.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">{t("admin.stats_no_data")}</td>
                </tr>
              ) : (
                revenueByWeek.map((r) => (
                  <tr
                    key={r.weekStart || r.weekLabel}
                    role="button"
                    tabIndex={0}
                    onClick={() => openWeekDetail(r)}
                    onKeyDown={(e) => e.key === "Enter" && openWeekDetail(r)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{r.weekLabel}</td>
                    <td style={{ textAlign: "right" }}>{r.count}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(Number(r.revenue))}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(Math.round(Number(r.revenue || 0) * 0.1))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {chartData.length > 0 && (
          <div className="stats-chart">
            <div className="stats-chart-title">{t("admin.total_revenue")} {t("admin.stats_chart_title_week")}</div>
            <div className="stats-chart-bars">
              {chartData.map((r, idx) => (
                <div
                  key={r.weekStart || idx}
                  className="stats-chart-bar-wrap"
                  role="button"
                  tabIndex={0}
                  onClick={() => openWeekDetail(r)}
                  onKeyDown={(e) => e.key === "Enter" && openWeekDetail(r)}
                  style={{ cursor: "pointer" }}
                  title={`${r.weekLabel}: ${formatMoney(Number(r.revenue))} – ${t("admin.stats_week_detail_click")}`}
                >
                  <div
                    className="stats-chart-bar"
                    style={{ height: `${Math.max(6, (r.revenue / maxChartRev) * 100)}%` }}
                  />
                  <div className="stats-chart-label">
                    {(r.weekLabel || "").split(" – ")[0]?.slice(0, 5) || r.weekStart?.slice(5) || ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {detailWeek && (
        <div className="stats-week-detail-overlay" onClick={closeWeekDetail} role="presentation">
          <div className="stats-week-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="stats-week-detail-header">
              <h3>{t("admin.stats_week_detail_title")} — {detailWeek.weekLabel}</h3>
              <button type="button" className="stats-week-detail-close" onClick={closeWeekDetail} aria-label={t("common.close")}>×</button>
            </div>
            <div className="stats-week-detail-body">
              {detailLoading ? (
                <div className="stats-week-detail-loading">{t("common.loading_stats")}</div>
              ) : detailBookings.length === 0 ? (
                <div className="stats-week-detail-empty">{t("admin.stats_no_data")}</div>
              ) : (
                <div className="stats-table-wrap">
                  <table className="stats-table stats-week-detail-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t("admin.stats_detail_code")}</th>
                        <th>{t("admin.stats_detail_room")}</th>
                        <th>{t("admin.stats_detail_guest")}</th>
                        <th>{t("admin.stats_detail_checkin")}</th>
                        <th>{t("admin.stats_detail_checkout")}</th>
                        <th>{t("admin.stats_detail_amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailBookings.map((b) => (
                        <tr
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openBookingDetail(b)}
                          onKeyDown={(e) => e.key === "Enter" && openBookingDetail(b)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{b.id}</td>
                          <td>{b.lookup_code}</td>
                          <td>{b.room_name}</td>
                          <td>{b.full_name}</td>
                          <td>{formatDDMMYYYY(b.check_in)}</td>
                          <td>{formatDDMMYYYY(b.check_out)}</td>
                          <td style={{ fontWeight: 700 }}>{formatMoney(Number(b.total_amount || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(detailBooking || detailBookingLoading) && (
        <div
          className="admin-booking-detail-modal-overlay"
          style={{ zIndex: 1001 }}
          role="dialog"
          aria-modal="true"
          onClick={() => !detailBookingLoading && closeBookingDetail()}
        >
          <div className="admin-booking-detail-modal" onClick={(e) => e.stopPropagation()}>
            {detailBookingLoading ? (
              <div className="admin-booking-detail-body" style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--muted)" }}>
                {t("common.loading_stats")}
              </div>
            ) : detailBooking ? (
              <>
                <div className="admin-booking-detail-header">
                  <h2 id="booking-detail-title">{t("admin.stats_booking_detail_title")} #{detailBooking.id}</h2>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={closeBookingDetail}>{t("common.close")}</button>
                </div>
                <div className="admin-booking-detail-body">
                  <div className="admin-booking-detail-grid">
                    <div><span className="muted">{t("admin.stats_detail_code")}:</span> <b>{detailBooking.lookup_code}</b></div>
                    <div><span className="muted">{t("admin.stats_detail_source")}:</span> {detailBooking.source === "google_sheet" ? "Google Sheet" : "Web"}</div>
                    <div><span className="muted">{t("admin.stats_detail_room")}:</span> {detailBooking.room_name}</div>
                    <div><span className="muted">{t("admin.stats_detail_booking_type")}:</span> {detailBooking.booking_type === "hourly" ? t("home.rent_hourly") : t("home.rent_overnight")}</div>
                    <div><span className="muted">{t("admin.stats_detail_guest")}:</span> {detailBooking.full_name}</div>
                    <div><span className="muted">{t("admin.stats_detail_phone")}:</span> {detailBooking.phone}</div>
                    <div><span className="muted">Email:</span> {detailBooking.email || "—"}</div>
                    <div><span className="muted">{t("admin.stats_detail_checkin")}:</span> {detailBooking.check_in} {detailBooking.check_in_time ? `(${detailBooking.check_in_time})` : ""}</div>
                    <div><span className="muted">{t("admin.stats_detail_checkout")}:</span> {detailBooking.check_out} {detailBooking.check_out_time ? `(${detailBooking.check_out_time})` : ""}</div>
                    <div><span className="muted">{t("admin.stats_detail_guests_count")}:</span> {detailBooking.guests}</div>
                    <div><span className="muted">{t("admin.stats_detail_note")}:</span> {detailBooking.note || "—"}</div>
                    <div><span className="muted">{t("admin.stats_detail_amount")}:</span> <b>{formatMoney(Number(detailBooking.total_amount || 0))}</b></div>
                    <div><span className="muted">{t("admin.stats_detail_paid")}:</span> {formatMoney(Number(detailBooking.paid_amount || 0))}</div>
                    <div><span className="muted">{t("admin.stats_detail_payment_method")}:</span> {paymentMethodLabel(detailBooking.payment_method)}</div>
                    <div><span className="muted">{t("admin.stats_detail_payment_status")}:</span> <span className={paymentStatusClass(getDisplayPaymentStatus(detailBooking))}>{paymentStatusLabel(getDisplayPaymentStatus(detailBooking))}</span></div>
                    <div><span className="muted">{t("admin.stats_detail_status")}:</span> <span className={bookingStatusClass(detailBooking.status)}>{bookingStatusLabel(detailBooking.status)}</span></div>
                  </div>
                </div>
                <div className="admin-booking-detail-actions">
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleSetStatus(detailBooking.id, "pending")}>{t("admin.stats_status_pending")}</button>
                  {detailBooking.payment_method === "cash" && (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleSetStatus(detailBooking.id, "confirmed")}>{t("admin.stats_status_confirm")}</button>
                  )}
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleSetStatus(detailBooking.id, "canceled")}>{t("admin.stats_status_cancel")}</button>
                  {detailBooking.payment_method === "cash" && (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleMarkPaid(detailBooking)}>{t("admin.stats_mark_paid")}</button>
                  )}
                  <button className="btn danger btn-sm" type="button" onClick={() => handleDelete(detailBooking.id)}>{t("admin.stats_delete")}</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
