import { useState, useCallback } from "react";
import { fetchRoomReviews } from "../api";

export function useAdminReviews() {
  const [reviewsPanel, setReviewsPanel] = useState(null);
  const [lbReview, setLbReview] = useState({ open: false, images: [], index: 0 });

  const openReviews = useCallback(async (room) => {
    try {
      const d = await fetchRoomReviews(room.id);
      setReviewsPanel({
        roomId: room.id,
        roomName: room.name,
        reviews: d.reviews || [],
      });
    } catch (e) {
      alert("Lỗi tải đánh giá: " + (e?.message || e));
    }
  }, []);

  return {
    reviewsPanel,
    setReviewsPanel,
    lbReview,
    setLbReview,
    openReviews,
  };
}
