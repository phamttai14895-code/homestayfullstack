import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updateProfile } from "../api";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";
import { useUser } from "../context/User.jsx";

export default function Profile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { me, loading, refresh } = useUser();
  const [form, setForm] = useState({ name: "", date_of_birth: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  usePageTitle(t("profile.page_title") + " — Homestay", t("profile.meta_desc"));

  useEffect(() => {
    if (!me) return;
    setForm({
      name: me.name || "",
      date_of_birth: me.date_of_birth || "",
      phone: me.phone || "",
      email: me.email || ""
    });
  }, [me]);

  useEffect(() => {
    if (loading) return;
    if (!me) {
      navigate("/", { replace: true });
    }
  }, [loading, me, navigate]);

  const submit = (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    setSaving(true);
    updateProfile({
      name: form.name.trim(),
      date_of_birth: form.date_of_birth.trim(),
      phone: form.phone.trim(),
      email: form.email.trim()
    })
      .then(() => {
        refresh();
        setOk(t("profile.saved"));
        setTimeout(() => setOk(""), 3000);
      })
      .catch((e) => setErr(e?.message || t("common.try_again")))
      .finally(() => setSaving(false));
  };

  if (loading || !me) {
    return (
      <div className="container">
        <div className="card2"><p className="muted">{t("common.loading")}</p></div>
      </div>
    );
  }

  return (
    <main className="container profile-page" role="main" id="main-content">
      <header className="header profile-page__header">
        <h1>{t("profile.page_title")}</h1>
        <p className="muted">{t("profile.subtitle")}</p>
      </header>
      <div className="card2 profile-page__card">
        <form className="profile-form" onSubmit={submit}>
          {err && <p className="error-message" role="alert">{err}</p>}
          {ok && <p className="profile-form__success">{ok}</p>}
          <div className="input">
            <label htmlFor="profile-name">{t("profile.full_name")} <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              id="profile-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              required
              placeholder={t("profile.full_name_placeholder")}
            />
          </div>
          <div className="input">
            <label htmlFor="profile-dob">{t("profile.date_of_birth")}</label>
            <input
              id="profile-dob"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm((s) => ({ ...s, date_of_birth: e.target.value }))}
            />
          </div>
          <div className="input">
            <label htmlFor="profile-phone">{t("profile.phone")} <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              id="profile-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              required
              placeholder={t("profile.phone_placeholder")}
            />
          </div>
          <div className="input">
            <label htmlFor="profile-email">{t("profile.email")} <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              required
              placeholder={t("profile.email_placeholder")}
            />
          </div>
          <p className="profile-form__hint muted">{t("profile.hint")}</p>
          <div className="profile-form__actions">
            <Link className="btn btn-ghost" to="/">{t("common.back_to_home")}</Link>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? t("common.loading") : t("profile.save")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
