import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe } from "../api";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return fetchMe()
      .then((d) => {
        setMe(d.user || null);
        return d;
      })
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = { me, setMe, loading, refresh };
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
