import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import Topbar from "./components/Topbar.jsx";
import FloatingContact from "./components/FloatingContact.jsx";
import ThemeToggleFloat from "./components/ThemeToggleFloat.jsx";
import ErrorBoundary, { ErrorFallback } from "./components/ErrorBoundary.jsx";
import { useI18n } from "./context/I18n.jsx";
import { useUser } from "./context/User.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const RoomDetail = lazy(() => import("./pages/RoomDetail.jsx"));
const Booking = lazy(() => import("./pages/Booking.jsx"));
const BookingStatus = lazy(() => import("./pages/BookingStatus.jsx"));
const MyBookings = lazy(() => import("./pages/MyBookings.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const AdminStats = lazy(() => import("./pages/AdminStats.jsx"));
const Payment = lazy(() => import("./pages/Payment"));
const Faq = lazy(() => import("./pages/Faq.jsx"));
const Policy = lazy(() => import("./pages/Policy.jsx"));
const Sitemap = lazy(() => import("./pages/Sitemap.jsx"));
const Wishlist = lazy(() => import("./pages/Wishlist.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.jsx"));

function RequireAdmin({ children }) {
  const loc = useLocation();
  const { t } = useI18n();
  const { me, loading } = useUser();

  if (loading) {
    return (
      <div className="container">
        <div className="card2">
          <div className="muted">{t("common.checking_admin")}</div>
        </div>
      </div>
    );
  }

  if (!me?.is_admin) {
    return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  }

  return children;
}

const PageFallback = ({ t }) => (
  <div className="container"><div className="card2"><div className="muted">{t("common.loading")}</div></div></div>
);

export default function App() {
  const { t } = useI18n();
  return (
    <>
      <a href="#main-content" className="skip-link">{t("common.skip_link")}</a>
      <Topbar />
      <ErrorBoundary fallback={({ retry }) => <ErrorFallback t={t} retry={retry} />}>
        <Suspense fallback={<PageFallback t={t} />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:id" element={<RoomDetail />} />
          <Route path="/booking/:id" element={<Booking />} />
          <Route path="/booking-status" element={<BookingStatus />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wishlist" element={<Wishlist />} />

          <Route
            path="/admin/stats"
            element={
              <RequireAdmin>
                <AdminStats />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            }
          />

          <Route path="/payment/:id" element={<Payment />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/chinh-sach" element={<Policy />} />
          <Route path="/sitemap" element={<Sitemap />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <footer className="site-footer" role="contentinfo">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand-wrap">
              <span className="footer-brand">🏡 Homestay</span>
              <span className="footer-tagline">{t("common.footer_tagline")}</span>
            </div>
            <nav className="footer-nav" aria-label="Liên kết chính">
              <Link to="/" className="footer-link">{t("common.home")}</Link>
              <Link to="/booking-status" className="footer-link">{t("common.search_booking")}</Link>
              <Link to="/my-bookings" className="footer-link">{t("common.my_bookings")}</Link>
              <Link to="/wishlist" className="footer-link">{t("common.wishlist")}</Link>
              <Link to="/faq" className="footer-link">{t("common.faq")}</Link>
              <Link to="/chinh-sach" className="footer-link">{t("common.policy")}</Link>
              <Link to="/sitemap" className="footer-link">{t("common.sitemap")}</Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <p className="footer-copy">© {new Date().getFullYear()} Homestay. {t("common.footer_copyright")}</p>
          </div>
        </div>
      </footer>
      <ThemeToggleFloat />
      <FloatingContact />

    </>
  );
}
