import React from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";

export default function Faq() {
  const { t } = useI18n();
  usePageTitle(t("common.faq") + " — Homestay", t("faq.meta_desc"));

  return (
    <main className="container" role="main" id="main-content">
      <header className="header">
        <h1>{t("common.faq")}</h1>
        <p className="muted">{t("faq.subtitle")}</p>
      </header>
      <div className="card2" style={{ maxWidth: 720 }}>
        <h2 className="section-title">{t("faq.how_to_book")}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>{t("faq.how_to_book_ans")}</p>
        <h2 className="section-title">{t("faq.where_lookup")}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>{t("faq.where_lookup_ans_before")}<Link to="/booking-status">{t("common.search")}</Link>{t("faq.where_lookup_ans_after")}</p>
        <h2 className="section-title">{t("faq.checkin_checkout")}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>{t("faq.checkin_checkout_ans")}</p>
        <h2 className="section-title">{t("faq.cancel_change")}</h2>
        <p className="muted">{t("faq.cancel_change_ans")}</p>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link className="btn btn-ghost" to="/">{t("common.back_to_home")}</Link>
      </p>
    </main>
  );
}
