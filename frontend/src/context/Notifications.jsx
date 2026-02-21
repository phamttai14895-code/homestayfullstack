import React, { createContext, useCallback, useContext, useState } from "react";

const NotificationsContext = createContext(null);

/**
 * Lưu thông báo client (vd: đặt đơn thành công).
 * - booking_success: { id, type: 'booking_success', bookingId, lookupCode }
 */
export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);

  const addNotification = useCallback((item) => {
    const id = item.id ?? `n-${Date.now()}`;
    setItems((prev) => [...prev, { ...item, id }]);
  }, []);

  const removeNotification = useCallback((id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearBookingSuccess = useCallback((bookingId) => {
    setItems((prev) => prev.filter((n) => !(n.type === "booking_success" && n.bookingId === bookingId)));
  }, []);

  const value = { items, addNotification, removeNotification, clearBookingSuccess };
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
