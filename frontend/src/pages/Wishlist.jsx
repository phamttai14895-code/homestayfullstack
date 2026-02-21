import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE, imageUrl, fetchWishlist } from "../api";
import { usePageTitle } from "../utils/usePageTitle";
import { useI18n } from "../context/I18n.jsx";
import { useCurrency } from "../context/Currency.jsx";
import { useUser } from "../context/User.jsx";
import { useWishlist } from "../context/Wishlist.jsx";

export default function Wishlist() {
  const { t } = useI18n();
  const { formatMoney } = useCurrency();
  const nav = useNavigate();
  const { me } = useUser();
  const { removeFromWishlist } = useWishlist();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  usePageTitle(t("wishlist.title") + " — Homestay", t("wishlist.subtitle"));

  useEffect(() => {
    if (!me) {
      setRooms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchWishlist()
      .then((d) => setRooms(d.rooms || []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [me?.id]);

  if (!me) {
    return (
      <main className="container" role="main" id="main-content">
        <div className="header">
          <div className="brand">
            <h1>{t("wishlist.title")}</h1>
            <p>{t("wishlist.subtitle")}</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => nav("/")}>{t("common.home")}</button>
        </div>
        <div className="card2">
          <p>{t("wishlist.login_to_add")}</p>
          <a className="btn btn-sm" href={`${BASE}/auth/google`} style={{ marginTop: 12 }}>{t("common.login_google")}</a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="container" role="main" id="main-content">
        <div className="muted">{t("common.loading")}</div>
      </main>
    );
  }

  return (
    <main className="container" role="main" id="main-content">
      <div className="header">
        <div className="brand">
          <h1>{t("wishlist.title")}</h1>
          <p>{t("wishlist.subtitle")}</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => nav("/")}>{t("common.home")}</button>
      </div>

      {rooms.length === 0 ? (
        <div className="card2" style={{ textAlign: "center", padding: 32 }}>
          <p className="muted">{t("wishlist.empty")}</p>
          <Link to="/" className="btn btn-sm" style={{ marginTop: 12 }}>{t("common.home")}</Link>
        </div>
      ) : (
        <section className="grid" aria-label={t("wishlist.title")}>
          {rooms.map((r) => {
            const cover = r.image_url ? imageUrl(r.image_url) : "";
            return (
              <div key={r.id} className="card" style={{ position: "relative" }}>
                <Link to={`/room/${r.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div className="thumb">
                    {cover ? (
                      <img src={cover} alt={r.name || t("home.room_alt")} loading="lazy" width={400} height={250} />
                    ) : (
                      <div className="ph">{t("common.no_photo")}</div>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="title">{r.name}</div>
                    <div className="muted">{r.location}</div>
                    <div className={`card-rating ${r.review_count > 0 ? "has-reviews" : "no-reviews"}`}>
                      {r.review_count > 0 && r.average_stars != null ? r.average_stars : "—"} ★ {r.review_count > 0 ? `(${r.review_count} ${t("common.reviews_count")})` : `(${t("common.no_reviews")})`}
                    </div>
                    <div className="price-row" style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                      <span className="price-chip">{formatMoney(Number(r.price_per_night || 0))} / {t("common.per_night")}</span>
                      <span className="price-chip muted">{formatMoney(Number(r.price_per_hour || 0))} / {t("common.per_hour")}</span>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  className="wishlist-btn wishlist-btn--active"
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      await removeFromWishlist(r.id);
                      setRooms((prev) => prev.filter((x) => x.id !== r.id));
                    } catch {}
                  }}
                  aria-label={t("wishlist.remove")}
                  title={t("wishlist.remove")}
                >
                  ♥
                </button>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
