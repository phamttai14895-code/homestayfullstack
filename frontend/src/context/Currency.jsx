import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useI18n } from "./I18n.jsx";
import { fetchExchangeRate } from "../api.js";

const FALLBACK_VND_TO_USD = Number(import.meta.env.VITE_VND_TO_USD) || 25000;

const CurrencyContext = createContext(null);

/** Tiền tệ gắn với ngôn ngữ: VI → VND, EN → USD. Tỉ giá VND/USD lấy theo ngày từ API. */
export function CurrencyProvider({ children }) {
  const { locale } = useI18n();
  const [vndPerUsd, setVndPerUsd] = useState(null);
  const currency = locale === "en" ? "USD" : "VND";

  useEffect(() => {
    fetchExchangeRate()
      .then((d) => {
        const v = Number(d?.vnd_per_usd);
        if (v > 0 && Number.isFinite(v)) setVndPerUsd(v);
      })
      .catch(() => {});
  }, []);

  const rate = (typeof vndPerUsd === "number" && vndPerUsd > 0) ? vndPerUsd : FALLBACK_VND_TO_USD;

  const formatMoney = useCallback(
    (amountVnd) => {
      const num = Number(amountVnd) || 0;
      if (currency === "USD") {
        const safeRate = rate > 0 ? rate : FALLBACK_VND_TO_USD;
        const usd = num / safeRate;
        const usdSafe = Number.isFinite(usd) && usd >= 0 ? usd : 0;
        try {
          const s = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(usdSafe);
          return (s && String(s).trim()) ? s : `$${usdSafe.toFixed(2)}`;
        } catch {
          return `$${usdSafe.toFixed(2)}`;
        }
      }
      try {
        const s = new Intl.NumberFormat("vi-VN").format(num) + "đ";
        return (s && String(s).trim()) ? s : `${num}đ`;
      } catch {
        return `${num}đ`;
      }
    },
    [currency, rate]
  );

  const value = useMemo(
    () => ({ currency, formatMoney, VND_TO_USD: rate }),
    [currency, formatMoney, rate]
  );
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
