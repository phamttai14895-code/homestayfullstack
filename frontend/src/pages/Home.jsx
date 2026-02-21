import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRooms, BASE, imageUrl } from "../api";
import { usePageTitle } from "../utils/usePageTitle";
import { setJsonLd, removeJsonLd } from "../utils/seo";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";
import { useUser } from "../context/User.jsx";
import { useWishlist } from "../context/Wishlist.jsx";
import ShareDropdown from "../components/ShareDropdown.jsx";

export default function Home() {
  const { t, locale } = useI18n();
  const { formatMoney, VND_TO_USD } = useCurrency();
  const { me } = useUser();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [rooms, setRooms] = useState([]);
  const [q, setQ] = useState("");
  const [rentType, setRentType] = useState("overnight");
  const [err, setErr] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRoom, setShareRoom] = useState({ id: null, name: "" });

  usePageTitle(t("common.home") + " — Homestay", "Xem danh sách phòng homestay, đặt phòng qua đêm hoặc theo giờ. Tìm kiếm theo tên và địa điểm.");

  useEffect(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setJsonLd({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${base}/#organization`,
          name: "Homestay",
          url: base,
        },
        {
          "@type": "WebSite",
          "@id": `${base}/#website`,
          url: base,
          name: "Homestay",
          description: "Đặt phòng homestay qua đêm hoặc theo giờ. Tìm kiếm theo tên và địa điểm.",
          publisher: { "@id": `${base}/#organization` },
        },
      ],
    });
    return () => removeJsonLd();
  }, []);

  useEffect(() => {
    fetchRooms()
      .then((d) => setRooms(d.rooms || []))
      .catch(() => setErr(t("home.err_load_rooms")));
  }, [t]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = rooms;
    if (t) {
      list = rooms.filter(r =>
        String(r.name).toLowerCase().includes(t) ||
        String(r.location).toLowerCase().includes(t)
      );
    }
    return list;
  }, [q, rooms]);

  return (
    <main className="container" role="main" id="main-content">
      <section className="hero" aria-label="Giới thiệu">
        <h1>{t("home.title")}</h1>
        <p>{t("home.subtitle")}</p>

        <div className="chips" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`chip ${rentType === "overnight" ? "on" : ""}`}
            onClick={() => setRentType("overnight")}
          >
            {t("home.rent_overnight")}
          </button>
          <button
            type="button"
            className={`chip ${rentType === "hourly" ? "on" : ""}`}
            onClick={() => setRentType("hourly")}
          >
            {t("home.rent_hourly")}
          </button>
        </div>

        <div className="hero-toolbar">
          <div className="searchbar">
            <span>🔎</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search_placeholder")} />
            <span className="count">{filtered.length}</span>
          </div>
          <div className="home-exchange-rate" aria-label={t("home.exchange_rate").replace("{rate}", String(VND_TO_USD))}>
            <span className="home-exchange-rate__icon" aria-hidden>💱</span>
            <span className="home-exchange-rate__text">
              {t("home.exchange_rate").replace("{rate}", new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN").format(VND_TO_USD))}
            </span>
          </div>
        </div>
      </section>

      {err && <p className="error-message" role="alert">{err}</p>}

      <section className="grid" aria-label="Danh sách phòng">
        {filtered.map((r, i) => {
          const cover = r.image_url ? imageUrl(r.image_url) : "";
          const priceNight = Number(r.price_per_night || 0);
          const priceHour = Number(r.price_per_hour || 0);
          const isFirst = i === 0;
          return (
            <Link key={r.id} to={`/room/${r.id}?rent=${rentType}`} className="card" style={{ position: "relative" }}>
              {me && (
                <button
                  type="button"
                  className={`wishlist-btn ${isInWishlist(r.id) ? "wishlist-btn--active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const wasInWishlist = isInWishlist(r.id);
                    toggleWishlist(r.id)
                      .then(() => {
                        if (!wasInWishlist) {
                          setShareRoom({ id: r.id, name: r.name || "" });
                          setShareOpen(true);
                        }
                      })
                      .catch(() => {});
                  }}
                  aria-label={isInWishlist(r.id) ? t("wishlist.remove") : t("wishlist.add")}
                  title={isInWishlist(r.id) ? t("wishlist.remove") : t("wishlist.add")}
                >
                  {isInWishlist(r.id) ? "♥" : "♡"}
                </button>
              )}
              <div className="thumb">
                {cover ? (
                  <img
                    src={cover}
                    alt={r.name || t("home.room_alt")}
                    width={400}
                    height={250}
                    loading={isFirst ? "eager" : "lazy"}
                    fetchpriority={isFirst ? "high" : undefined}
                  />
                ) : (
                  <div className="ph">{t("common.no_photo")}</div>
                )}
              </div>
              <div className="card-body">
                <div className="title">{r.name}</div>
                <div className="muted">{r.location}</div>
                <div className={`card-rating ${r.review_count > 0 ? "has-reviews" : "no-reviews"}`}>
                  {r.review_count > 0 && r.average_stars != null ? r.average_stars : "—"} ★ {r.review_count > 0 ? `(${r.review_count} ${t("common.reviews_count")})` : ""}
                </div>
                <div className="price-row" style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                  <span className={`price-chip ${rentType === "overnight" ? "active" : ""}`}>
                    {formatMoney(priceNight)} / {t("common.per_night")}
                  </span>
                  <span className={`price-chip ${rentType === "hourly" ? "active" : ""}`}>
                    {formatMoney(priceHour)} / {t("common.per_hour")}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {filtered.length === 0 && !err && (
        <div className="card2" style={{ textAlign: "center", padding: 32 }}>
          <p className="muted" style={{ marginBottom: 8 }}>{rooms.length === 0 ? t("common.no_rooms") : t("common.no_rooms_filter")}</p>
          <p className="muted" style={{ fontSize: 14 }}>{t("common.try_search")}</p>
        </div>
      )}

      <ShareDropdown
        open={shareOpen}
        onClose={() => { setShareOpen(false); setShareRoom({ id: null, name: "" }); }}
        url={shareRoom.id != null ? `/room/${shareRoom.id}` : ""}
      />
    </main>
  );
}
