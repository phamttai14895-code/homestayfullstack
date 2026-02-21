import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminStats } from "../api";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";

function formatMonthOption(ym) {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const months = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

/** Format YYYY-MM-DD thành dd-mm-yyyy (giống backend). */
function formatDDMMYYYY(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

/** Từ selectedMonth (YYYY-MM) trả về [periodStart, periodEnd] dạng YYYY-MM-DD. */
function getPeriodFromMonth(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return [
    `${ym}-01`,
    `${ym}-${String(lastDay).padStart(2, "0")}`
  ];
}

export default function AdminStats() {
  const { t } = useI18n();
  const { formatMoney } = useCurrency();
  usePageTitle(t("admin.stats_title") + " — Admin");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    setData(null);
    setErr("");
    fetchAdminStats(selectedMonth || undefined)
      .then(setData)
      .catch((e) => setErr(e?.message || t("admin.err_stats")));
  }, [selectedMonth, t]);

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
    byMonth,
    totalBookings,
    totalRevenue,
    revenueByMonth,
    revenueByDay,
    occupancyRate,
    totalRoomNights,
    maxRoomNights,
    numRooms = 0,
    periodStartFormatted = "",
    periodEndFormatted = ""
  } = data;

  const _maxRev = Math.max(1, ...(revenueByMonth || []).map((r) => r.revenue));
  const chartData = byMonth && revenueByDay?.length ? revenueByDay : revenueByMonth || [];
  const maxChartRev = chartData.length ? Math.max(1, ...chartData.map((r) => r.revenue)) : 1;

  const periodRange = getPeriodFromMonth(selectedMonth);
  const finalStart = periodStartFormatted
    || (periodRange ? formatDDMMYYYY(periodRange[0]) : null)
    || (data.periodStart ? formatDDMMYYYY(data.periodStart) : null)
    || "—";
  const finalEnd = periodEndFormatted
    || (periodRange ? formatDDMMYYYY(periodRange[1]) : null)
    || (data.periodEnd ? formatDDMMYYYY(data.periodEnd) : null)
    || "—";

  const monthOptions = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthOptions.push(ym);
  }

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
          <div className="stats-month-picker">
            <select
              className="stats-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="">{t("admin.last_12_months")}</option>
              {monthOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthOption(ym)}
                </option>
              ))}
            </select>
          </div>
          <Link className="btn btn-ghost" to="/admin">{t("admin.admin_back")}</Link>
        </div>
      </header>

      <section className="stats-cards">
        <div className="card2 stats-card">
          <div className="stats-card-label">{t("admin.total_bookings")}</div>
          <div className="stats-card-value">{Number(totalBookings || 0).toLocaleString()}</div>
          <div className="stats-card-hint muted">{byMonth ? t("admin.stats_booking_hint_month") : t("admin.stats_booking_hint_all")}</div>
        </div>
        <div className="card2 stats-card stats-card-revenue">
          <div className="stats-card-label">{t("admin.stats_revenue_label")}</div>
          <div className="stats-card-value">{formatMoney(Number(totalRevenue || 0))}</div>
          <div className="stats-card-hint muted">{byMonth ? t("admin.stats_revenue_hint_month") : t("admin.stats_revenue_hint_all")}</div>
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
        <h2 className="stats-section-title">
          {byMonth ? t("admin.stats_section_by_day") : t("admin.stats_section_by_month")}
        </h2>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{byMonth ? t("admin.stats_table_date") : t("admin.stats_table_month")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.stats_table_orders")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.stats_table_revenue")}</th>
                <th style={{ textAlign: "right" }}>{t("admin.stats_table_discount")}</th>
              </tr>
            </thead>
            <tbody>
              {byMonth && revenueByDay ? (
                revenueByDay.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">{t("admin.stats_no_data_month")}</td>
                  </tr>
                ) : (
                  revenueByDay.map((r) => (
                    <tr key={r.date_iso || r.date}>
                      <td>{r.date}</td>
                      <td style={{ textAlign: "right" }}>{r.count}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(Number(r.revenue))}</td>
                      <td style={{ textAlign: "right" }}>{formatMoney(Math.round(Number(r.revenue || 0) * 0.1))}</td>
                    </tr>
                  ))
                )
              ) : revenueByMonth?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">{t("admin.stats_no_data")}</td>
                </tr>
              ) : (
                (revenueByMonth || []).map((r) => (
                  <tr key={r.month}>
                    <td>{r.monthLabel || r.month}</td>
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
            <div className="stats-chart-title">
              {t("admin.total_revenue")} {byMonth ? t("admin.stats_chart_title_day") : t("admin.stats_chart_title_month")}
            </div>
            <div className="stats-chart-bars">
              {chartData.map((r, idx) => (
                <div key={r.date || r.month || idx} className="stats-chart-bar-wrap">
                  <div
                    className="stats-chart-bar"
                    style={{ height: `${Math.max(6, (r.revenue / maxChartRev) * 100)}%` }}
                    title={`${r.date || r.monthLabel || r.month}: ${formatMoney(Number(r.revenue))}`}
                  />
                  <div className="stats-chart-label">
                    {byMonth ? (r.date || "").slice(0, 5) : formatMonthOption(r.month)}
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
