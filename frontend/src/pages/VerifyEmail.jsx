import React, { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useI18n } from "../context/I18n.jsx";
import { useUser } from "../context/User.jsx";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { refresh } = useUser();
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success === "1") refresh();
  }, [success, refresh]);

  return (
    <main className="container" role="main" id="main-content">
      <div className="card2" style={{ maxWidth: 480, margin: "48px auto", textAlign: "center" }}>
        {success === "1" ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 style={{ margin: "0 0 12px", color: "var(--pri)" }}>{t("auth.verify_success")}</h2>
            <Link to="/" className="btn" style={{ marginTop: 24 }}>
              {t("common.home")}
            </Link>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16, color: "var(--muted)" }}>⚠</div>
            <h2 style={{ margin: "0 0 12px", color: "var(--text)" }}>
              {error === "EXPIRED_OR_INVALID" ? t("auth.verify_expired") : "Link không hợp lệ."}
            </h2>
            <Link to="/" className="btn btn-ghost" style={{ marginTop: 24 }}>
              {t("common.back_home")}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
