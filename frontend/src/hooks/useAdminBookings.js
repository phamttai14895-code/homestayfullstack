import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminBookings,
  adminDeleteBooking,
  adminSetBookingStatus,
  adminSetBookingPayment,
} from "../api";
import { useDebounced } from "./useDebounced.js";

const BOOKING_PAGE_SIZE = 5;

function sortBookingsLikeServer(arr) {
  return [...arr].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

export function useAdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [bank, setBank] = useState(null);
  const [q, setQ] = useState("");
  const [statusChip, setStatusChip] = useState("");
  const [sourceChip, setSourceChip] = useState("");
  const dq = useDebounced(q, 350);
  const [bookingPage, setBookingPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [lastChecked, setLastChecked] = useState(null);
  const selectAllRef = useRef(null);
  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;
  const [undoState, setUndoState] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const loadBookings = useCallback(async () => {
    try {
      const d = await adminBookings({ q: dq, status: statusChip, source: sourceChip });
      setBookings(d.bookings || []);
      setBank(d.bank || null);
    } catch {
      // ignore if not admin
    }
  }, [dq, statusChip, sourceChip]);

  const reloadBookings = useCallback(async () => {
    const res = await adminBookings({ q: dq, status: statusChip, source: sourceChip });
    setBookings(res.bookings || []);
    setBank(res.bank || null);
  }, [dq, statusChip, sourceChip]);

  useEffect(() => {
    setBookingPage(1);
  }, [dq, statusChip, sourceChip, bookings.length]);

  useEffect(() => {
    if (!undoState) return;
    const t = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(t);
  }, [undoState]);

  const bookingPagination = useMemo(() => {
    const total = bookings.length;
    const totalPages = Math.max(1, Math.ceil(total / BOOKING_PAGE_SIZE));
    const page = Math.min(Math.max(1, bookingPage), totalPages);
    const start = (page - 1) * BOOKING_PAGE_SIZE;
    const pageItems = bookings.slice(start, start + BOOKING_PAGE_SIZE);
    return { totalPages, currentPage: page, pageItems, start };
  }, [bookings, bookingPage]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const pageItems = bookingPagination.pageItems;
    const selectedOnPage = pageItems.filter((b) => selectedIds.has(b.id)).length;
    selectAllRef.current.indeterminate =
      selectedOnPage > 0 && selectedOnPage < pageItems.length;
  }, [selectedIds, bookingPagination.pageItems]);

  const isSelected = (id) => selectedIds.has(id);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastChecked(null);
  }, []);

  const toggleAll = useCallback(
    (e) => {
      const checked = e.target.checked;
      const pageItems = bookingPagination.pageItems;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (!checked) {
          pageItems.forEach((b) => next.delete(b.id));
          return next;
        }
        pageItems.forEach((b) => next.add(b.id));
        return next;
      });
    },
    [bookingPagination.pageItems]
  );

  const toggleOne = useCallback((id, index, e) => {
    const checked = e.target.checked;
    const list = bookingsRef.current;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastChecked != null && list[lastChecked]) {
        const start = Math.min(lastChecked, index);
        const end = Math.max(lastChecked, index);
        for (let i = start; i <= end; i++) {
          const bid = list[i].id;
          if (checked) next.add(bid);
          else next.delete(bid);
        }
      } else {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setLastChecked(index);
  }, [lastChecked]);

  const commitUndoState = useCallback(
    async (state) => {
      if (!state) return;
      try {
        await Promise.all(state.ids.map((id) => adminDeleteBooking(id)));
      } catch (e) {
        await reloadBookings();
        throw e;
      } finally {
        await reloadBookings();
      }
    },
    [reloadBookings]
  );

  const cancelPendingUndoAndCommitIfAny = useCallback(() => {
    if (!undoState) return;
    try {
      clearTimeout(undoState.timer);
    } catch {}
    const old = undoState;
    setUndoState(null);
    commitUndoState(old).catch(() => {});
  }, [undoState, commitUndoState]);

  const requestDeleteWithUndo = useCallback(
    (ids, mode = "bulk") => {
      if (!ids.length) return;
      cancelPendingUndoAndCommitIfAny();
      const idSet = new Set(ids);
      const items = bookings.filter((b) => idSet.has(b.id));
      setBookings((prev) => prev.filter((b) => !idSet.has(b.id)));
      clearSelection();
      const delayMs = 8000;
      const deadline = Date.now() + delayMs;
      const timer = setTimeout(async () => {
        setUndoState(null);
        await commitUndoState({ ids, items, deadline, timer: null, mode });
      }, delayMs);
      setUndoState({ ids, items, deadline, timer, mode });
    },
    [
      bookings,
      cancelPendingUndoAndCommitIfAny,
      clearSelection,
      commitUndoState,
    ]
  );

  const undoDelete = useCallback(() => {
    if (!undoState) return;
    try {
      clearTimeout(undoState.timer);
    } catch {}
    const items = undoState.items || [];
    setUndoState(null);
    setBookings((prev) => sortBookingsLikeServer([...prev, ...items]));
  }, [undoState]);

  const deleteSelectedPro = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Xóa ${ids.length} booking đã chọn? Bạn sẽ có 8 giây để hoàn tác.`))
      return;
    requestDeleteWithUndo(ids, "bulk");
  }, [selectedIds, requestDeleteWithUndo]);

  const deleteSinglePro = useCallback(
    (id) => {
      if (!confirm(`Xóa booking #${id}? Bạn sẽ có 8 giây để hoàn tác.`)) return;
      requestDeleteWithUndo([id], "single");
    },
    [requestDeleteWithUndo]
  );

  const confirmUndoDeleteNow = useCallback(() => {
    if (!undoState) return;
    try {
      clearTimeout(undoState.timer);
    } catch {}
    const st = undoState;
    setUndoState(null);
    commitUndoState(st).catch(() => {});
  }, [undoState, commitUndoState]);

  const setBStatus = useCallback(
    async (id, status) => {
      try {
        await adminSetBookingStatus(id, status);
        await loadBookings();
      } catch (e) {
        throw new Error(e?.message || "Lỗi");
      }
    },
    [loadBookings]
  );

  const markPaid = useCallback(
    async (b) => {
      try {
        await adminSetBookingPayment(b.id, "paid", Number(b.total_amount || 0));
        await reloadBookings();
      } catch (e) {
        alert(`Lỗi: ${e.message}`);
      }
    },
    [reloadBookings]
  );

  useEffect(() => {
    loadBookings();
    const t = setInterval(loadBookings, 5000);
    return () => clearInterval(t);
  }, [loadBookings]);

  const remainingSec = undoState
    ? Math.ceil(Math.max(0, undoState.deadline - nowTick) / 1000)
    : 0;

  const statusChips = [
    { key: "", label: "Tất cả" },
    { key: "pending", label: "Chờ xác nhận" },
    { key: "confirmed", label: "Đã xác nhận" },
    { key: "canceled", label: "Đã hủy" },
  ];

  const sourceChips = [
    { key: "", label: "Tất cả" },
    { key: "web", label: "Đơn web" },
    { key: "google_sheet", label: "Đơn Google Sheet" },
  ];

  return {
    bookings,
    bank,
    q,
    setQ,
    statusChip,
    setStatusChip,
    statusChips,
    sourceChip,
    setSourceChip,
    sourceChips,
    bookingPagination,
    bookingPage,
    setBookingPage,
    BOOKING_PAGE_SIZE,
    loadBookings,
    reloadBookings,
    setBStatus,
    markPaid,
    selectedIds,
    selectedCount: selectedIds.size,
    selectAllRef,
    isSelected,
    clearSelection,
    toggleAll,
    toggleOne,
    undoState,
    remainingSec,
    undoDelete,
    commitUndoState,
    confirmUndoDeleteNow,
    deleteSelectedPro,
    deleteSinglePro,
  };
}
