import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchWishlist, addToWishlist as apiAdd, removeFromWishlist as apiRemove } from "../api";
import { useUser } from "./User.jsx";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { me } = useUser();
  const [roomIds, setRoomIds] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!me) {
      setRoomIds([]);
      return;
    }
    setLoading(true);
    try {
      const d = await fetchWishlist();
      setRoomIds(d.room_ids || []);
    } catch {
      setRoomIds([]);
    } finally {
      setLoading(false);
    }
  }, [me?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isInWishlist = useCallback((roomId) => roomIds.includes(Number(roomId)), [roomIds]);

  const addToWishlist = useCallback(async (roomId) => {
    if (!me) return;
    try {
      await apiAdd(roomId);
      setRoomIds((prev) => (prev.includes(Number(roomId)) ? prev : [...prev, Number(roomId)]));
    } catch (e) {
      throw e;
    }
  }, [me?.id]);

  const removeFromWishlist = useCallback(async (roomId) => {
    if (!me) return;
    try {
      await apiRemove(roomId);
      setRoomIds((prev) => prev.filter((id) => id !== Number(roomId)));
    } catch (e) {
      throw e;
    }
  }, [me?.id]);

  const toggleWishlist = useCallback(async (roomId) => {
    if (!me) return;
    if (isInWishlist(roomId)) await removeFromWishlist(roomId);
    else await addToWishlist(roomId);
  }, [me?.id, isInWishlist, addToWishlist, removeFromWishlist]);

  const value = {
    roomIds,
    loading,
    refresh,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
