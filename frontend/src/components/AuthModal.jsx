import React, { useState } from "react";
import { BASE, register, loginEmail, resendVerifyEmail } from "../api";
import { useI18n } from "../context/I18n.jsx";
import { useUser } from "../context/User.jsx";

export default function AuthModal({ open, onClose }) {
  const { t } = useI18n();
  const { refresh } = useUser();
  const [mode, setMode] = useState("oauth"); // oauth | register | login | resend
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setErr("");
    setSuccess("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setName("");
  };

  const handleClose = () => {
    reset();
    setMode("oauth");
    onClose();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErr("");
    setSuccess("");
    if (password.length < 6) {
      setErr(t("auth.err_password_short"));
      return;
    }
    if (password !== passwordConfirm) {
      setErr(t("auth.err_password_mismatch"));
      return;
    }
    setLoading(true);
    try {
      await register({ email: email.trim(), password, name: name.trim() });
      setSuccess(t("auth.register_success"));
      setPassword("");
      setPasswordConfirm("");
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("EMAIL_EXISTS")) setErr(t("auth.err_email_exists"));
      else if (msg.includes("PASSWORD_TOO_SHORT")) setErr(t("auth.err_password_short"));
      else setErr(msg || "Lỗi đăng ký.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerify = async () => {
    if (!email.trim()) return;
    setErr("");
    setLoading(true);
    try {
      await resendVerifyEmail(email.trim());
      setSuccess(t("auth.resend_verify_success"));
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("NOT_FOUND_OR_ALREADY_VERIFIED")) setErr(t("auth.resend_verify_not_found"));
      else if (msg.includes("TOO_MANY_REQUESTS")) setErr(t("auth.err_too_many_requests") || "Vui lòng thử lại sau vài phút.");
      else setErr(msg || "Lỗi.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await loginEmail(email.trim(), password);
      refresh();
      handleClose();
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("INVALID_CREDENTIALS")) setErr(t("auth.err_invalid_credentials"));
      else if (msg.includes("EMAIL_NOT_VERIFIED")) setErr(t("auth.err_email_not_verified"));
      else setErr(msg || t("auth.err_invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="login-modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="login-modal" onClick={(e) => e.stopPropagation()} role="document">
        <div className="login-modal__head">
          <h2 id="auth-modal-title" className="login-modal__title">
            {mode === "oauth" ? t("common.login") : mode === "register" ? t("common.register") : mode === "resend" ? t("auth.resend_verify_btn") : t("common.login")}
          </h2>
          <button type="button" className="login-modal__close" onClick={handleClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        {mode === "oauth" && (
          <div className="login-modal__options">
            <a className="login-modal__btn login-modal__btn--fb" href={`${BASE}/auth/facebook`} onClick={handleClose}>
              <span className="login-modal__btn-icon">f</span>
              {t("common.login_facebook")}
            </a>
            <a className="login-modal__btn login-modal__btn--google" href={`${BASE}/auth/google`} onClick={handleClose}>
              <span className="login-modal__btn-icon">G</span>
              {t("common.login_google")}
            </a>
            <div className="login-modal__divider">
              <span>{t("common.or")}</span>
            </div>
            <button
              type="button"
              className="login-modal__btn login-modal__btn--email"
              onClick={() => { setMode("register"); reset(); }}
            >
              {t("common.register_email")}
            </button>
            <button
              type="button"
              className="login-modal__link"
              onClick={() => { setMode("login"); reset(); }}
            >
              {t("common.login_email")}
            </button>
          </div>
        )}

        {mode === "resend" && (
          <div className="login-modal__form">
            {success && <p className="login-modal__success" role="alert">{success}</p>}
            {err && <p className="login-modal__error" role="alert">{err}</p>}
            <div className="input">
              <label htmlFor="auth-resend-email">{t("common.email")}</label>
              <input
                id="auth-resend-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("common.email")}
                autoComplete="email"
              />
            </div>
            <button
              type="button"
              className="login-modal__btn login-modal__btn--submit"
              disabled={loading || !email.trim()}
              onClick={handleResendVerify}
            >
              {loading ? t("common.loading") : t("auth.resend_verify_btn")}
            </button>
            <button type="button" className="login-modal__link" onClick={() => { setMode("login"); reset(); }}>
              ← {t("common.login_email")}
            </button>
            <button type="button" className="login-modal__link" onClick={() => { setMode("oauth"); reset(); }}>
              ← {t("auth.back")}
            </button>
          </div>
        )}

        {(mode === "register" || mode === "login") && (
          <form
            className="login-modal__form"
            onSubmit={mode === "register" ? handleRegister : handleLogin}
          >
            {success && <p className="login-modal__success" role="alert">{success}</p>}
            {err && <p className="login-modal__error" role="alert">{err}</p>}
            {mode === "register" && success ? (
              <>
                <p className="login-modal__hint muted" style={{ marginBottom: 12 }}>{t("auth.check_email_hint")}</p>
                <button
                  type="button"
                  className="login-modal__btn login-modal__btn--submit"
                  disabled={loading}
                  onClick={handleResendVerify}
                >
                  {loading ? t("common.loading") : t("auth.resend_verify_btn")}
                </button>
                <button type="button" className="login-modal__link" onClick={() => { setSuccess(""); setErr(""); }}>
                  {t("common.login_email")}
                </button>
                <button type="button" className="login-modal__link" onClick={() => { setMode("oauth"); reset(); }}>
                  ← {t("auth.back")}
                </button>
              </>
            ) : (
              <>
                <div className="input">
                  <label htmlFor="auth-email">{t("common.email")}</label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                {mode === "register" && (
                  <div className="input">
                    <label htmlFor="auth-name">{t("common.name")}</label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                )}
                <div className="input">
                  <label htmlFor="auth-password">{t("common.password")}</label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                  />
                </div>
                {mode === "register" && (
                  <div className="input">
                    <label htmlFor="auth-password-confirm">{t("common.password_confirm")}</label>
                    <input
                      id="auth-password-confirm"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                )}
                <button type="submit" className="login-modal__btn login-modal__btn--submit" disabled={loading}>
                  {loading ? t("common.loading") : mode === "register" ? t("common.register") : t("common.login")}
                </button>
                <button
                  type="button"
                  className="login-modal__link"
                  onClick={() => { setMode(mode === "register" ? "login" : "register"); reset(); }}
                >
                  {mode === "register" ? t("common.login_email") : t("common.register_email")}
                </button>
                <button type="button" className="login-modal__link" onClick={() => { setMode("resend"); setErr(""); setSuccess(""); setPassword(""); setPasswordConfirm(""); setName(""); }}>
                  {t("auth.resend_verify_btn")}
                </button>
                <button type="button" className="login-modal__link" onClick={() => { setMode("oauth"); reset(); }}>
                  ← {t("auth.back")}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
