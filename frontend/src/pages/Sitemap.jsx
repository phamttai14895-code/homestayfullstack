import React from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";

export default function Sitemap() {
  const { t } = useI18n();
  usePageTitle(t("common.sitemap") + " — Homestay", t("common.sitemap_desc"));

  return (
    <main className="container" role="main">
      <div className="header">
        <h1>{t("common.sitemap")}</h1>
        <p className="muted">{t("common.sitemap_desc")}</p>
      </div>
      <div className="card2" style={{ maxWidth: 480 }}>
        <nav className="sitemap-nav">
          <Link to="/">{t("common.home")}</Link>
          <Link to="/booking-status">{t("common.search_booking")}</Link>
          <Link to="/my-bookings">{t("common.my_bookings")}</Link>
          <Link to="/faq">{t("common.faq")}</Link>
          <Link to="/chinh-sach">{t("common.policy")}</Link>
        </nav>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link className="btn btn-ghost" to="/">{t("common.back_to_home")}</Link>
      </p>
    </main>
  );
}
