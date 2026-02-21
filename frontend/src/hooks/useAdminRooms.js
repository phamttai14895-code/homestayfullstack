import { useCallback, useEffect, useState, useRef } from "react";
import {
  adminRooms,
  adminCreateRoom,
  adminUpdateRoom,
  adminDeleteRoom,
  adminUploadRoomImages,
  adminDeleteImage,
  adminSetThumbnail,
  adminReorderRoomImages,
  adminDayPrices,
  adminSetDayPrice,
} from "../api";
import { parseAmenities, parseUrls, safeArr } from "../utils/parse.js";

export function useAdminRooms() {
  const [err, setErr] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomForm, setRoomForm] = useState({
    id: null,
    name: "",
    location: "",
    price_per_night: 0,
    price_per_hour: 0,
    description: "",
    amenities: [],
  });
  const [dayPricesPanel, setDayPricesPanel] = useState(null);
  const [pickedRoom, setPickedRoom] = useState(null);
  const imagePanelRef = useRef(null);
  const dragIndex = useRef(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await adminRooms();
      setRooms(r.rooms || []);
    } catch (e) {
      setErr(
        e.message === "FORBIDDEN"
          ? "Bạn không có quyền admin."
          : e.message === "UNAUTHORIZED"
            ? "Bạn cần login admin."
            : `Lỗi: ${e.message}`
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setRoomForm({
      id: null,
      name: "",
      location: "",
      price_per_night: 0,
      price_per_hour: 0,
      description: "",
      amenities: [],
    });
  }, []);

  const saveRoom = useCallback(
    async (e) => {
      e.preventDefault();
      setErr("");
      try {
        const payload = {
          name: roomForm.name,
          location: roomForm.location,
          price_per_night: Number(roomForm.price_per_night || 0),
          price_per_hour: Number(roomForm.price_per_hour || 0),
          description: roomForm.description || "",
          amenities: safeArr(roomForm.amenities),
        };
        if (roomForm.id) {
          await adminUpdateRoom(roomForm.id, payload);
          await load();
          setRoomForm((f) => ({ ...f, ...payload }));
        } else {
          await adminCreateRoom(payload);
          await load();
          resetForm();
        }
      } catch (e2) {
        setErr(`Lỗi: ${e2.message}`);
      }
    },
    [roomForm, load, resetForm]
  );

  const removeRoom = useCallback(
    async (id) => {
      if (!confirm("Xoá phòng? (sẽ xoá luôn ảnh trong uploads)")) return;
      setErr("");
      try {
        await adminDeleteRoom(id);
        setPickedRoom((p) => (p?.id === id ? null : p));
        await load();
      } catch (e2) {
        setErr(`Lỗi: ${e2.message}`);
      }
    },
    [load]
  );

  const pickRoom = useCallback((r) => {
    const roomData = {
      ...r,
      amenities: parseAmenities(r.amenities),
      image_urls: parseUrls(r.image_urls),
    };
    setPickedRoom(roomData);
    requestAnimationFrame(() => {
      imagePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const uploadMulti = useCallback(
    async (files) => {
      setErr("");
      if (!pickedRoom) return;
      try {
        const res = await adminUploadRoomImages(pickedRoom.id, files);
        const updated = res.room;
        setPickedRoom({
          ...updated,
          amenities: parseAmenities(updated.amenities),
          image_urls: parseUrls(updated.image_urls),
        });
        await load();
      } catch (e) {
        setErr(`Upload lỗi: ${e.message}`);
      }
    },
    [pickedRoom, load]
  );

  const delImg = useCallback(
    async (url) => {
      if (!confirm("Xoá ảnh? (sẽ xoá file trong uploads)")) return;
      setErr("");
      if (!pickedRoom) return;
      try {
        const res = await adminDeleteImage(pickedRoom.id, url);
        const updated = res.room;
        setPickedRoom({
          ...updated,
          amenities: parseAmenities(updated.amenities),
          image_urls: parseUrls(updated.image_urls),
        });
        await load();
      } catch (e) {
        setErr(`Xoá ảnh lỗi: ${e.message}`);
      }
    },
    [pickedRoom, load]
  );

  const setThumb = useCallback(
    async (url) => {
      setErr("");
      if (!pickedRoom) return;
      try {
        const res = await adminSetThumbnail(pickedRoom.id, url);
        const updated = res.room;
        setPickedRoom({
          ...updated,
          amenities: parseAmenities(updated.amenities),
          image_urls: parseUrls(updated.image_urls),
        });
        await load();
      } catch (e) {
        setErr(`Set thumbnail lỗi: ${e.message}`);
      }
    },
    [pickedRoom, load]
  );

  const onDragStart = useCallback((i) => {
    dragIndex.current = i;
  }, []);

  const onDrop = useCallback(
    async (i) => {
      const from = dragIndex.current;
      dragIndex.current = null;
      if (from == null || !pickedRoom) return;
      const list = [...safeArr(pickedRoom.image_urls)];
      const [moved] = list.splice(from, 1);
      list.splice(i, 0, moved);
      setPickedRoom((s) => ({ ...s, image_urls: list }));
      try {
        const res = await adminReorderRoomImages(pickedRoom.id, list);
        const updated = res.room;
        setPickedRoom({
          ...updated,
          amenities: parseAmenities(updated.amenities),
          image_urls: parseUrls(updated.image_urls),
        });
        await load();
      } catch (e) {
        setErr(`Reorder lỗi: ${e.message}`);
      }
    },
    [pickedRoom, load]
  );

  const openDayPrices = useCallback(async (room) => {
    try {
      const month = new Date().toISOString().slice(0, 7);
      const d = await adminDayPrices(room.id, month);
      setDayPricesPanel({
        roomId: room.id,
        roomName: room.name,
        month,
        day_prices: d.day_prices || {},
      });
    } catch (e) {
      alert("Lỗi tải giá/ngày: " + (e?.message || e));
    }
  }, []);

  const setDayPrice = useCallback(
    async (roomId, iso, value) => {
      try {
        await adminSetDayPrice(roomId, iso, value);
        setDayPricesPanel((s) => ({
          ...s,
          day_prices: { ...s.day_prices, [iso]: value },
        }));
      } catch (err) {
        alert("Lỗi lưu giá: " + (err?.message || err));
      }
    },
    []
  );

  const loadDayPricesForMonth = useCallback(async (month) => {
    if (!dayPricesPanel || !month) return;
    try {
      const d = await adminDayPrices(dayPricesPanel.roomId, month);
      setDayPricesPanel((s) => ({ ...s, month, day_prices: d.day_prices || {} }));
    } catch (err) {
      alert("Lỗi tải giá tháng: " + (err?.message || err));
    }
  }, [dayPricesPanel]);

  return {
    err,
    setErr,
    rooms,
    roomForm,
    setRoomForm,
    dayPricesPanel,
    setDayPricesPanel,
    pickedRoom,
    setPickedRoom,
    imagePanelRef,
    load,
    resetForm,
    saveRoom,
    removeRoom,
    pickRoom,
    uploadMulti,
    delImg,
    setThumb,
    onDragStart,
    onDrop,
    openDayPrices,
    setDayPrice,
    loadDayPricesForMonth,
    parseAmenities,
  };
}
