import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import vi from "../locales/vi.json";
import en from "../locales/en.json";

const STORAGE_KEY = "homestay_locale";
const messages = { vi, en };

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "vi") return saved;
    } catch (_) { /* localStorage unavailable (e.g. private mode) */ }
    return "vi";
  });

  const setLocale = useCallback((next) => {
    if (next !== "vi" && next !== "en") return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) { /* localStorage unavailable */ }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "en" ? "en" : "vi";
    }
  }, [locale]);

  const t = useCallback(
    (key) => {
      const dict = messages[locale] || messages.vi;
      const value = key.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), dict);
      return value != null ? String(value) : key;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
