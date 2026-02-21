import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../context/I18n.jsx";

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ZaloIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4C12.95 4 4 12.95 4 24c0 5.52 2.2 10.53 5.76 14.16L6 44l6.2-3.56A19.8 19.8 0 0 0 24 44c11.05 0 20-8.95 20-20S35.05 4 24 4z" fill="#0068FF"/>
      <path d="M24 8c8.84 0 16 7.16 16 16s-7.16 16-16 16c-4.2 0-8.1-1.62-11-4.28l-.76-.44-3.96 2.28.98-3.8-.58-.56A15.92 15.92 0 0 1 8 24c0-8.84 7.16-16 16-16zm-4.5 9.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm9 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-8.08 6.2c.3.6 1.2 1.2 2.4 1.2 1.2 0 2.1-.6 2.4-1.2.1-.2.1-.5-.1-.7-.2-.2-.5-.2-.7-.1-.1.2-.5.4-.9.4s-.8-.2-.9-.4c-.2-.1-.5 0-.7.1-.2.2-.2.5-.1.7zm5.58.7c.9 0 1.7-.4 2.2-1 .2-.2.2-.5 0-.7-.2-.2-.5-.2-.7 0-.3.4-.8.6-1.3.6s-1-.2-1.3-.6c-.2-.2-.5-.2-.7 0-.2.2-.2.5 0 .7.5.6 1.3 1 2.2 1z" fill="#fff"/>
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 3.41 1.74 6.44 4.39 8.38V22l3.94-2.17c1.05.29 2.16.45 3.3.45 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm0 17.12c-1.05 0-2.06-.18-3-.5l-.22-.07-2.28 1.26.61-2.37-.14-.23C4.7 15.96 3.5 13.95 3.5 11.7 3.5 7.3 7.23 4 12 4s8.5 3.3 8.5 7.7-3.73 7.7-8.5 7.7z"/>
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function FloatingContact() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);

  const phone = import.meta.env.VITE_CONTACT_PHONE || "0900000000";
  const phoneTel = String(phone).replace(/\s+/g, "");
  const zaloLink = import.meta.env.VITE_ZALO_LINK || `https://zalo.me/${phoneTel}`;
  const messengerLink = import.meta.env.VITE_MESSENGER_LINK || "https://m.me/yourpage";

  useEffect(() => {
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, []);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(phoneTel);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert(t("common.copy_phone_fail"));
    }
  }

  return (
    <div ref={wrapRef} className="fc-wrap">
      <div className={`fc-panel ${open ? "fc-panel--open" : ""}`}>
        <div className="fc-panel__head">
          <span className="fc-panel__icon" aria-hidden="true"><ChatIcon /></span>
          <h3 className="fc-panel__title">{t("common.contact")}</h3>
          <button
            type="button"
            className="fc-panel__close"
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="fc-panel__body">
          <a className="fc-channel" href={zaloLink} target="_blank" rel="noreferrer">
            <span className="fc-channel__icon fc-channel__icon--zalo"><ZaloIcon /></span>
            <div className="fc-channel__text">
              <span className="fc-channel__name">Zalo</span>
              <span className="fc-channel__desc">{t("common.zalo_desc")}</span>
            </div>
            <span className="fc-channel__arrow" aria-hidden="true">›</span>
          </a>

          <a className="fc-channel" href={messengerLink} target="_blank" rel="noreferrer">
            <span className="fc-channel__icon fc-channel__icon--messenger"><MessengerIcon /></span>
            <div className="fc-channel__text">
              <span className="fc-channel__name">Messenger</span>
              <span className="fc-channel__desc">{t("common.messenger_desc")}</span>
            </div>
            <span className="fc-channel__arrow" aria-hidden="true">›</span>
          </a>

          <div className="fc-hotline">
            <a className="fc-hotline__link" href={`tel:${phoneTel}`} aria-label={`Gọi ${phoneTel}`}>
              <span className="fc-hotline__icon"><PhoneIcon /></span>
              <div className="fc-hotline__text">
                <span className="fc-hotline__label">{t("common.hotline")}</span>
                <span className="fc-hotline__number">{phone}</span>
              </div>
              <span className="fc-hotline__call">{t("common.call_now")}</span>
            </a>
            <button
              type="button"
              className="fc-hotline__copy"
              onClick={copyPhone}
              aria-label={t("common.copy")}
            >
              <CopyIcon />
              <span>{copied ? t("common.copied") : t("common.copy")}</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`fc-btn ${open ? "fc-btn--open" : ""}`}
        onClick={() => setOpen((s) => !s)}
        aria-label={open ? t("common.close_contact") : t("common.open_contact")}
        aria-expanded={open}
      >
        <span className="fc-btn__icon">
          {open ? <CloseIcon /> : <ChatIcon />}
        </span>
        <span className="fc-btn__label">{t("common.contact")}</span>
        <span className="fc-btn__dot" aria-hidden="true" />
      </button>
    </div>
  );
}
