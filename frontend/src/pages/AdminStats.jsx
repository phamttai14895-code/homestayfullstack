import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { fetchAdminStats } from "../api";
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
                  <tr key={r.weekStart || r.weekLabel}>
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
                <div key={r.weekStart || idx} className="stats-chart-bar-wrap">
                  <div
                    className="stats-chart-bar"
                    style={{ height: `${Math.max(6, (r.revenue / maxChartRev) * 100)}%` }}
                    title={`${r.weekLabel}: ${formatMoney(Number(r.revenue))}`}
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
    </div>
  );
}
