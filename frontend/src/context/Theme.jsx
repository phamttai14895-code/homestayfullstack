import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "homestay_theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDarkState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") return saved === "dark";
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return true;
    } catch (_) { /* localStorage unavailable */ }
    return false;
  });

  const setDark = useCallback((v) => {
    const next = !!v;
    setDarkState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch (_) {}
    document.documentElement.classList.toggle("dark-mode", next);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", dark);
  }, [dark]);

  const toggle = useCallback(() => setDark(!dark), [dark, setDark]);

  const value = useMemo(() => ({ dark, setDark, toggle }), [dark, setDark, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
