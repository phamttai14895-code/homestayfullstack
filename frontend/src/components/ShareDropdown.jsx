import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../context/I18n.jsx";

const FB_SHARE = "https://www.facebook.com/sharer/sharer.php?u=";
const ZALO_SHARE = "https://sp.zalo.me/share_inline?u=";
const CLICK_OUTSIDE_DELAY_MS = 500;

function getFullUrl(url) {
  if (typeof window === "undefined" || !url) return "";
  return url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? url : "/" + url}`;
}

function SharePanel({ t, fullUrl, fbUrl, zaloUrl, copied, handleCopy, openFb, openZalo, onClose }) {
  return (
    <div className="share-dropdown" role="dialog" aria-label={t("share.title")}>
      <div className="share-dropdown-head">
        <span className="share-dropdown-title">{t("share.title")}</span>
        <button type="button" className="share-dropdown-close" onClick={onClose} aria-label={t("common.close")}>×</button>
      </div>
      <div className="share-dropdown-body">
        <button type="button" className="share-popup-btn share-popup-copy" onClick={handleCopy} disabled={!fullUrl} aria-pressed={copied}>
          <span className="share-popup-icon">🔗</span>
          <span>{copied ? t("share.copied") : t("share.copy_link")}</span>
        </button>
        <div className="share-popup-social">
          <button type="button" className="share-popup-btn share-popup-fb" onClick={openFb} disabled={!fullUrl}>
            <span className="share-popup-icon">f</span>
            <span>{t("share.facebook")}</span>
          </button>
          <button type="button" className="share-popup-btn share-popup-zalo" onClick={openZalo} disabled={!fullUrl}>
            <span className="share-popup-icon">z</span>
            <span>{t("share.zalo")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShareDropdown({ open, onClose, url, children }) {
  const { t } = useI18n();
  const wrapRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const listenerRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const isCenterMode = children === undefined || children === null;

  const fullUrl = useMemo(() => (open ? getFullUrl(url) : ""), [open, url]);
  const fbUrl = fullUrl ? FB_SHARE + encodeURIComponent(fullUrl) + "&display=popup" : "";
  const zaloUrl = fullUrl ? ZALO_SHARE + encodeURIComponent(fullUrl) : "";

  const handleCopy = useCallback(() => {
    if (!fullUrl) return;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [fullUrl]);

  const openFb = useCallback(() => {
    if (!fbUrl) return;
    const w = 580, h = 400;
    const left = Math.round((window.screen?.width ?? 800) / 2 - w / 2);
    const top = Math.round((window.screen?.height ?? 600) / 2 - h / 2);
    window.open(fbUrl, "fb-share", `width=${w},height=${h},left=${left},top=${top}`);
  }, [fbUrl]);

  const openZalo = useCallback(() => {
    if (!zaloUrl) return;
    window.open(zaloUrl, "_blank", "noopener,noreferrer");
  }, [zaloUrl]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      if (listenerRef.current) {
        document.removeEventListener("mousedown", listenerRef.current);
        document.removeEventListener("touchstart", listenerRef.current);
        listenerRef.current = null;
      }
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      return;
    }
    const tId = setTimeout(() => {
      const closeIfOutside = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
      };
      listenerRef.current = closeIfOutside;
      document.addEventListener("mousedown", closeIfOutside);
      document.addEventListener("touchstart", closeIfOutside, { passive: true });
    }, CLICK_OUTSIDE_DELAY_MS);
    return () => {
      clearTimeout(tId);
      if (listenerRef.current) {
        document.removeEventListener("mousedown", listenerRef.current);
        document.removeEventListener("touchstart", listenerRef.current);
      }
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [open, onClose]);

  const panel = open ? (
    <SharePanel
      t={t}
      fullUrl={fullUrl}
      fbUrl={fbUrl}
      zaloUrl={zaloUrl}
      copied={copied}
      handleCopy={handleCopy}
      openFb={openFb}
      openZalo={openZalo}
      onClose={onClose}
    />
  ) : null;

  if (isCenterMode) {
    if (!open) return null;
    const fixedWrap = (
      <div ref={wrapRef} className="share-dropdown-fixed">
        {panel}
      </div>
    );
    return typeof document !== "undefined" ? createPortal(fixedWrap, document.body) : fixedWrap;
  }

  return (
    <div ref={wrapRef} className="share-dropdown-wrap">
      {children}
      {panel}
    </div>
  );
}
