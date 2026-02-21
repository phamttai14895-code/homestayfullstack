import React from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";

export default function Policy() {
  const { t } = useI18n();
  usePageTitle(t("common.policy") + " — Homestay", t("policy.meta_desc"));

  return (
    <main className="container" role="main">
      <div className="header">
        <h1>{t("common.policy")}</h1>
        <p className="muted">{t("policy.subtitle")}</p>
      </div>
      <div className="card2" style={{ maxWidth: 720 }}>
        <h2 className="section-title">{t("policy.payment")}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>{t("policy.payment_ans")}</p>
        <h2 className="section-title">{t("policy.cancel")}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>{t("policy.cancel_ans")}</p>
        <h2 className="section-title">{t("policy.privacy")}</h2>
        <p className="muted">{t("policy.privacy_ans")}</p>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link className="btn btn-ghost" to="/">{t("common.back_to_home")}</Link>
      </p>
    </main>
  );
}
