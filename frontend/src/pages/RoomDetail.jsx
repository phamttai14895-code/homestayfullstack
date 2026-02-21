import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BASE, imageUrl, fetchRoomDetail, fetchAvailability, fetchRoomReviews } from "../api";
import Lightbox from "../components/Lightbox.jsx";
import { AmenitiesGrid } from "../components/AmenityIcons.jsx";
import { usePageTitle } from "../utils/usePageTitle";
import { setJsonLd, removeJsonLd } from "../utils/seo";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";
import { useUser } from "../context/User.jsx";
import { useWishlist } from "../context/Wishlist.jsx";
import ShareDropdown from "../components/ShareDropdown.jsx";

export default function RoomDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { formatMoney } = useCurrency();
  const { me } = useUser();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const rentType = searchParams.get("rent") || "overnight";
  const roomId = Number(id);

  const [room, setRoom] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [reviews, setReviews] = useState({ reviews: [], average_stars: null, total: 0 });
  const [err, setErr] = useState("");
  const [lb, setLb] = useState({ open: false, index: 0 });
  const [lbReview, setLbReview] = useState({ open: false, images: [], index: 0 });
  const REVIEWS_PER_PAGE = 5;
  const [reviewPage, setReviewPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setErr("");
    fetchRoomDetail(roomId)
      .then((d) => setRoom(d.room))
      .catch(() => setErr(t("room.err_load")));
    fetchAvailability(roomId)
      .then((d) => setBlocks(d.blocks || []))
      .catch(() => {});
    fetchRoomReviews(roomId)
      .then((d) => setReviews({ reviews: d.reviews || [], average_stars: d.average_stars ?? null, total: d.total || 0 }))
      .catch(() => setReviews({ reviews: [], average_stars: null, total: 0 }));
    setReviewPage(1);
  }, [roomId, t]);

  const reviewPagination = useMemo(() => {
    const list = reviews.reviews || [];
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE));
    const page = Math.min(Math.max(1, reviewPage), totalPages);
    const start = (page - 1) * REVIEWS_PER_PAGE;
    const pageReviews = list.slice(start, start + REVIEWS_PER_PAGE);
    return { pageReviews, currentPage: page, totalPages, start, total };
  }, [reviews.reviews, reviewPage, REVIEWS_PER_PAGE]);

  const images = useMemo(() => {
    if (!room) return [];
    const urls = Array.isArray(room.image_urls) ? room.image_urls : [];
    const list = urls.length ? urls : (room.image_url ? [room.image_url] : []);
    return list.map(u => imageUrl(u));
  }, [room]);

  const firstImage = images.length > 0 ? images[0] : null;
  usePageTitle(
    room?.name ? `${room.name} — Homestay` : null,
    room ? `${room.name} — ${formatMoney(room.price_per_night || 0)}/${t("common.per_night")}, ${formatMoney(room.price_per_hour || 0)}/${t("common.per_hour")}.` : null,
    { canonicalPath: `/room/${roomId}`, image: firstImage || undefined }
  );

  useEffect(() => {
    if (!room) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const urls = Array.isArray(room.image_urls) ? room.image_urls : (room.image_url ? [room.image_url] : []);
    const imageList = urls.map(u => imageUrl(u));
    const desc = room.name + (room.location ? " — " + room.location : "") + ". " + (t("common.per_night") + " / " + t("common.per_hour"));
    setJsonLd({
      "@context": "https://schema.org",
      "@type": "Accommodation",
      name: room.name,
      description: desc,
      image: imageList.length ? imageList : undefined,
      address: room.location ? { "@type": "PostalAddress", addressLocality: room.location } : undefined,
      url: `${base}/room/${roomId}`,
    });
    return () => removeJsonLd();
  }, [room, roomId]);

  const statusCounts = useMemo(() => {
    let pending = 0, confirmed = 0;
    for (const b of blocks) {
      if (b.status === "pending") pending++;
      if (b.status === "confirmed") confirmed++;
    }
    return { pending, confirmed };
  }, [blocks]);

  if (!room) {
    return (
      <div className="container">
        {err ? <p className="error-message">{err}</p> : <div className="muted">{t("common.loading")}</div>}
      </div>
    );
  }

  return (
    <main className="container" role="main" id="main-content">
      <header className="header">
        <div className="brand">
          <h1>{room.name}</h1>
          <p>{room.location}</p>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => nav("/")}>{t("common.home")}</button>
          <button
            type="button"
            className="btn-share"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShareOpen(true);
            }}
            aria-label={t("share.title")}
          >
            🔗 {t("share.title")}
          </button>
          <button
            className="btn"
            onClick={() => {
              if (!me) {
                alert(t("room.login_to_book"));
                return;
              }
              nav(`/booking/${roomId}?rent=${rentType}`);
            }}
          >
            {t("room.book")} {rentType === "hourly" ? t("room.book_hourly") : t("room.book_overnight")}
          </button>
        </div>
      </header>

      <div className="grid2">
        <div className="card2">
          <div className="room-detail-meta">
            <div className="room-detail-price-row">
              <div className="price big">{formatMoney(room.price_per_night || 0)} / {t("common.per_night")}</div>
              <div className="price big muted">{formatMoney(room.price_per_hour || 0)} / {t("common.per_hour")}</div>
            </div>
            <div className="room-wishlist-wrap">
              {me ? (
                <button
                  type="button"
                  className={`room-wishlist ${isInWishlist(roomId) ? "room-wishlist--saved" : ""}`}
                  onClick={() => {
                    const wasInWishlist = isInWishlist(roomId);
                    toggleWishlist(roomId)
                      .then(() => { if (!wasInWishlist) setShareOpen(true); })
                      .catch(() => {});
                  }}
                  aria-label={isInWishlist(roomId) ? t("wishlist.remove") : t("wishlist.add")}
                >
                  <span className="room-wishlist-icon">{isInWishlist(roomId) ? "♥" : "♡"}</span>
                  <span className="room-wishlist-label">
                    {isInWishlist(roomId) ? t("wishlist.remove") : t("wishlist.add")}
                  </span>
                </button>
              ) : (
                <a className="room-wishlist room-wishlist--login" href={`${BASE}/auth/google`}>
                  <span className="room-wishlist-icon">♡</span>
                  <span className="room-wishlist-label">{t("wishlist.login_to_add")}</span>
                </a>
              )}
            </div>
          </div>
          {reviews.total > 0 && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "#b45309" }}>
                {reviews.average_stars} ★
              </span>
              <span className="muted">({reviews.total} {t("common.reviews_count")})</span>
            </div>
          )}
          <div className="muted" style={{ marginTop: 6 }}>
            {t("room.checkin_checkout")}
          </div>

          <div className="gallery">
            {images.map((src, idx) => (
              <button key={src} className="gimg" onClick={() => setLb({ open: true, index: idx })}>
                <img
                  src={src}
                  alt={`${room.name} - ảnh ${idx + 1}`}
                  width={400}
                  height={250}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchpriority={idx === 0 ? "high" : undefined}
                />
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="section-title">{t("room.description")}</div>
            <div className="muted" style={{ marginTop: 6 }}>{room.description || "—"}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 950 }}>{t("room.amenities")}</div>
            <AmenitiesGrid amenities={room.amenities || []} />
          </div>

          {reviews.reviews.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="section-title">{t("room.reviews_title")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reviewPagination.pageReviews.map((rev) => (
                  <div key={rev.id} className="card2" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700 }}>{rev.user_name || t("room.review_guest")}</span>
                      <span style={{ color: "var(--warning)", fontWeight: 700 }}>{rev.stars} ★</span>
                    </div>
                    {rev.comment && <div className="muted" style={{ fontSize: 14 }}>{rev.comment}</div>}
                    {Array.isArray(rev.image_urls) && rev.image_urls.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{t("room.review_images_label")}</div>
                        <div className="review-thumbs">
                          {rev.image_urls.map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="review-thumb"
                              onClick={() => setLbReview({ open: true, images: rev.image_urls.map(u => imageUrl(u)), index: idx })}
                            >
                              <img src={imageUrl(url)} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {rev.admin_reply && (
                      <div style={{ marginTop: 10, padding: 10, background: "var(--pri-light)", borderRadius: 8, borderLeft: "4px solid var(--pri)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pri-hover)", marginBottom: 4 }}>{t("room.host_reply")}</div>
                        <div style={{ fontSize: 14 }}>{rev.admin_reply}</div>
                        {rev.admin_reply_at && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{rev.admin_reply_at}</div>}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{rev.created_at}</div>
                  </div>
                ))}
              </div>
              {reviewPagination.totalPages > 1 && (
                <div className="reviews-pagination" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {reviewPagination.start + 1}–{reviewPagination.start + reviewPagination.pageReviews.length} / {reviewPagination.total}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={reviewPagination.currentPage <= 1}
                    onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                  >
                    {t("room.reviews_prev")}
                  </button>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {t("room.reviews_page").replace("{page}", reviewPagination.currentPage).replace("{total}", reviewPagination.totalPages)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={reviewPagination.currentPage >= reviewPagination.totalPages}
                    onClick={() => setReviewPage((p) => Math.min(reviewPagination.totalPages, p + 1))}
                  >
                    {t("room.reviews_next")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card2">
          <div className="section-title">{t("room.status_section")}</div>
          <div className="legend">
            <span><i className="dot pending" /> {t("room.pending")}</span>
            <span><i className="dot confirmed" /> {t("room.confirmed")}</span>
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
            {t("room.blocked_dates")} <b>{statusCounts.pending}</b> {t("room.pending")} • <b>{statusCounts.confirmed}</b> {t("room.confirmed")}
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
{t("room.book_hint")}
          </div>
        </div>
      </div>

      {lb.open && (
        <Lightbox
          images={images}
          index={lb.index}
          onIndex={(i) => setLb(s => ({ ...s, index: i }))}
          onClose={() => setLb({ open: false, index: 0 })}
        />
      )}
      {lbReview.open && (
        <Lightbox
          images={lbReview.images}
          index={lbReview.index}
          onIndex={(i) => setLbReview(s => ({ ...s, index: i }))}
          onClose={() => setLbReview({ open: false, images: [], index: 0 })}
        />
      )}
      <ShareDropdown open={shareOpen} onClose={() => setShareOpen(false)} url={`/room/${roomId}`} />
    </main>
  );
}
