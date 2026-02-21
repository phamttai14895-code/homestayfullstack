import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { BASE, logout, myBookings } from "../api";
import AuthModal from "./AuthModal.jsx";
import { useI18n } from "../context/I18n.jsx";
import { useUser } from "../context/User.jsx";
import { useWishlist } from "../context/Wishlist.jsx";
import { useNotifications } from "../context/Notifications.jsx";

const NavIcon = ({ name }) => {
  const icons = {
    home: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
    search: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
    bookings: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
    wishlist: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>),
    faq: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
    policy: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
    sitemap: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>),
    admin: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
    profile: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  };
  return <span className="drawer-item__icon" aria-hidden="true">{icons[name] || null}</span>;
};

export default function Topbar() {
  const nav = useNavigate();
  const location = useLocation();
  const { t, locale, setLocale } = useI18n();
  const { me, refresh } = useUser();
  const { roomIds } = useWishlist();
  const { items: notificationItems, removeNotification, clearBookingSuccess } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [drawerUserDropdownOpen, setDrawerUserDropdownOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const avatarDropdownRef = useRef(null);

  const closeMenu = () => {
    setMenuOpen(false);
    setDrawerUserDropdownOpen(false);
  };

  useEffect(() => {
    if (dropdownOpen && me) {
      myBookings()
        .then((d) => setPendingReviews((d.bookings || []).filter((b) => b.can_review)))
        .catch(() => setPendingReviews([]));
    } else {
      setPendingReviews([]);
    }
  }, [dropdownOpen, me]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (!avatarDropdownOpen) return;
    setDropdownOpen(false);
    const onDown = (e) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(e.target)) setAvatarDropdownOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [avatarDropdownOpen]);

  useEffect(() => {
    if (!loginDropdownOpen) return;
    setDropdownOpen(false);
    setAvatarDropdownOpen(false);
    const onKey = (e) => { if (e.key === "Escape") setLoginDropdownOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loginDropdownOpen]);
  const isActive = (path) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  useEffect(() => {
    const onUserUpdated = () => refresh();
    window.addEventListener("user-updated", onUserUpdated);
    return () => window.removeEventListener("user-updated", onUserUpdated);
  }, [refresh]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      const onEscape = (e) => { if (e.key === "Escape") closeMenu(); };
      window.addEventListener("keydown", onEscape);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", onEscape);
      };
    }
  }, [menuOpen]);

  async function doLogout() {
    await logout().catch(() => {});
    await refresh();
    nav("/");
  }

  const drawerLinks = [
    { to: "/", label: t("common.home"), icon: "home" },
    { to: "/booking-status", label: t("common.search_booking"), icon: "search" },
    { to: "/my-bookings", label: t("common.my_bookings"), icon: "bookings" },
    { to: "/wishlist", label: t("common.wishlist"), icon: "wishlist" },
  ];
  if (me?.is_admin) {
    drawerLinks.push({ to: "/admin", label: t("common.admin"), icon: "admin" });
  }

  return (
    <div className="topbar-wrapper">
      <AuthModal open={loginDropdownOpen} onClose={() => { setLoginDropdownOpen(false); closeMenu(); }} />
      {/* Backdrop + Drawer (chỉ hiện trên mobile khi mở menu) */}
      <div
        className={`drawer-backdrop ${menuOpen ? "drawer-backdrop--open" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <aside
        className={`drawer-panel ${menuOpen ? "drawer-panel--open" : ""}`}
        aria-label={t("common.home")}
      >
        <div className="drawer-panel__head">
          <div className="drawer-panel__brand">
            <span className="logo">🏡</span>
            <span className="drawer-panel__title">Homestay</span>
          </div>
        </div>
        {me && (
          <div className="drawer-panel__user-wrap">
            <button
              type="button"
              className="drawer-panel__user"
              onClick={() => setDrawerUserDropdownOpen((o) => !o)}
              aria-expanded={drawerUserDropdownOpen}
              aria-label={t("common.account")}
            >
              <div className="drawer-panel__user-avatar">
                {me.avatar ? <img src={me.avatar} alt="" /> : <span className="avatar-placeholder">{me.name ? me.name.charAt(0).toUpperCase() : "?"}</span>}
              </div>
              <div className="drawer-panel__user-info">
                <span className="drawer-panel__user-name">{me.name || me.email}</span>
                {me.email && me.name && <span className="drawer-panel__user-email">{me.email}</span>}
              </div>
              <span className={`drawer-panel__user-chevron ${drawerUserDropdownOpen ? "drawer-panel__user-chevron--open" : ""}`} aria-hidden>▼</span>
            </button>
            {drawerUserDropdownOpen && (
              <div className="drawer-panel__user-dropdown">
                <Link
                  to="/profile"
                  className="drawer-panel__user-dropdown__item"
                  onClick={() => { closeMenu(); }}
                >
                  {t("common.personal_info")}
                </Link>
                <button
                  type="button"
                  className="drawer-panel__user-dropdown__item drawer-panel__user-dropdown__item--danger"
                  onClick={() => { doLogout(); closeMenu(); }}
                >
                  {t("common.logout")}
                </button>
              </div>
            )}
          </div>
        )}
        <nav className="drawer-panel__nav" aria-label="Menu chính">
          {drawerLinks.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              className={`drawer-item ${isActive(to) ? "drawer-item--active" : ""}`}
              onClick={closeMenu}
            >
              <NavIcon name={icon} />
              <span className="drawer-item__label">{label}</span>
              {icon === "wishlist" && roomIds.length > 0 && (
                <span className="drawer-item__badge">{roomIds.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="drawer-panel__footer">
          <div className="drawer-panel__locale" role="group" aria-label={t("common.language")}>
            <button type="button" className={`drawer-locale-btn ${locale === "vi" ? "drawer-locale-btn--on" : ""}`} onClick={() => setLocale("vi")} aria-pressed={locale === "vi"}>VI</button>
            <button type="button" className={`drawer-locale-btn ${locale === "en" ? "drawer-locale-btn--on" : ""}`} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>EN</button>
          </div>
        </div>
      </aside>

      <div className={`topbar ${menuOpen ? "menu-open" : ""}`}>
        <div className="topbar-inner">
          <div className="topbar-head">
            <div className="topbar-left" onClick={() => { nav("/"); closeMenu(); }}>
              <div className="logo">🏡</div>
              <div>
                <div className="t-title">Homestay</div>
                <div className="t-sub">{t("common.tagline")}</div>
              </div>
            </div>
            {!me && (
              <button
                type="button"
                className="topbar-login-mobile btn btn-sm"
                onClick={() => setLoginDropdownOpen(true)}
              >
                {t("common.login")}
              </button>
            )}
            <button
              type="button"
              className="topbar-hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? t("common.close") : "Menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <span className="topbar-hamburger-x">×</span>
              ) : (
                <span className="topbar-hamburger-lines">
                  <span /><span /><span />
                </span>
              )}
            </button>
          </div>

          <div className="topbar-right">
            <Link className="btn btn-ghost btn-sm" to="/" onClick={closeMenu}>{t("common.home")}</Link>
          {me && (
              <Link className="btn btn-ghost btn-sm" to="/my-bookings" onClick={closeMenu}>{t("common.my_bookings")}</Link>
          )}
            <Link className="btn btn-ghost btn-sm" to="/booking-status" onClick={closeMenu}>{t("common.search")}</Link>
            {!me && (
              <button
                type="button"
                className="btn btn-sm topbar-login-desktop"
                onClick={() => setLoginDropdownOpen(true)}
                aria-expanded={loginDropdownOpen}
                aria-haspopup="dialog"
              >
                {t("common.login")}
              </button>
            )}
          {me && (
            <>
              <Link className="btn btn-ghost btn-sm" to="/wishlist" onClick={closeMenu} title={t("common.wishlist")}>
                {t("common.wishlist")}{roomIds.length > 0 && <span className="wishlist-count"> ({roomIds.length})</span>}
              </Link>
            </>
          )}
            <div className="topbar-locale-toggle topbar-desktop-only" role="group" aria-label={t("common.language")} style={{ marginLeft: 4 }}>
              <button type="button" className={`locale-btn ${locale === "vi" ? "locale-btn--on" : ""}`} onClick={() => setLocale("vi")} aria-pressed={locale === "vi"}>VI</button>
              <button type="button" className={`locale-btn ${locale === "en" ? "locale-btn--on" : ""}`} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>EN</button>
            </div>
          {me ? (
            <>
              <div className="topbar-bell-wrap" ref={dropdownRef}>
                <button
                  type="button"
                  className="topbar-bell"
                  onClick={() => { setAvatarDropdownOpen(false); setDropdownOpen((o) => !o); }}
                  aria-label={t("common.notification_title")}
                  aria-expanded={dropdownOpen}
                  title={t("common.notification_title")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {(notificationItems.length > 0 || (me && me.review_pending_count > 0)) && (
                    <span className="topbar-bell__dot" aria-hidden="true" />
                  )}
                </button>
                {dropdownOpen && (
                  <div className="topbar-bell-dropdown" role="menu">
                    <div className="topbar-bell-dropdown__head">{t("common.notification_title")}</div>
                    <div className="topbar-bell-dropdown__list">
                      {notificationItems.filter((n) => n.type === "booking_success").map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          className="topbar-bell-dropdown__item"
                          role="menuitem"
                          onClick={() => {
                            clearBookingSuccess(n.bookingId);
                            removeNotification(n.id);
                            setDropdownOpen(false);
                            closeMenu();
                            nav("/my-bookings");
                          }}
                        >
                          <span className="topbar-bell-dropdown__item-title">{t("common.notification_booking_success")}</span>
                          <span className="topbar-bell-dropdown__item-meta">#{n.bookingId}{n.lookupCode ? ` • ${n.lookupCode}` : ""}</span>
                        </button>
                      ))}
                      {pendingReviews.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="topbar-bell-dropdown__item"
                          role="menuitem"
                          onClick={() => {
                            setDropdownOpen(false);
                            closeMenu();
                            nav("/my-bookings");
                          }}
                        >
                          <span className="topbar-bell-dropdown__item-title">{t("common.notification_review_pending")}</span>
                          <span className="topbar-bell-dropdown__item-meta">#{b.id} • {b.room_name || ""}</span>
                        </button>
                      ))}
                      {notificationItems.filter((n) => n.type === "booking_success").length === 0 && pendingReviews.length === 0 && (
                        <div className="topbar-bell-dropdown__empty">{t("common.notification_empty")}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="topbar-avatar-wrap" ref={avatarDropdownRef}>
                <button
                  type="button"
                  className="topbar-avatar-trigger"
                  onClick={() => { setDropdownOpen(false); setAvatarDropdownOpen((o) => !o); }}
                  aria-label={t("common.account")}
                  aria-expanded={avatarDropdownOpen}
                  title={t("common.account")}
                >
                  <div className="avatar-wrap">
                    {me.avatar ? <img className="avatar" src={me.avatar} alt="" /> : <span className="avatar avatar-placeholder">{me.name ? me.name.charAt(0).toUpperCase() : "?"}</span>}
                  </div>
                  <span className="uname" title={me.email}>{me.name || me.email}</span>
                </button>
                {avatarDropdownOpen && (
                  <div className="topbar-avatar-dropdown" role="menu">
                    <div className="topbar-avatar-dropdown__head">
                      <span className="topbar-avatar-dropdown__name">{me.name || me.email}</span>
                      {me.email && <span className="topbar-avatar-dropdown__email">{me.email}</span>}
                    </div>
                    <div className="topbar-avatar-dropdown__list">
                      <Link
                        to="/profile"
                        className="topbar-avatar-dropdown__item"
                        onClick={() => { setAvatarDropdownOpen(false); closeMenu(); }}
                      >
                        {t("common.personal_info")}
                      </Link>
                      {me.is_admin && (
                        <Link
                          to="/admin"
                          className="topbar-avatar-dropdown__item"
                          onClick={() => { setAvatarDropdownOpen(false); closeMenu(); }}
                        >
                          {t("common.admin")}
                        </Link>
                      )}
                      <button
                        type="button"
                        className="topbar-avatar-dropdown__item topbar-avatar-dropdown__item--danger"
                        onClick={() => { doLogout(); closeMenu(); setAvatarDropdownOpen(false); }}
                      >
                        {t("common.logout")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}
