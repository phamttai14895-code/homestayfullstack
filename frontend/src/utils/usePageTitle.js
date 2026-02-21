import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { setCanonical, setOgMeta } from "./seo.js";

const DEFAULT_DESCRIPTION = "Đặt phòng homestay nhanh chóng — xem phòng, chọn ngày, thanh toán chuyển khoản hoặc tiền mặt. Tra cứu đặt phòng bằng mã hoặc số điện thoại.";

function ensureMetaDescription() {
  let el = document.querySelector('meta[name="description"]');
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", "description");
    document.head.appendChild(el);
  }
  return el;
}

/**
 * @param {string} [title]
 * @param {string} [description]
 * @param {{ canonicalPath?: string, image?: string }} [opts] - canonicalPath: path (vd. /room/1). image: URL ảnh cho og:image (absolute hoặc /path).
 */
export function usePageTitle(title, description, opts = {}) {
  const location = useLocation();
  const { canonicalPath, image } = opts;

  useEffect(() => {
    if (title != null && title !== "") {
      document.title = title;
    }
  }, [title]);

  useEffect(() => {
    const meta = ensureMetaDescription();
    const content = description != null && description !== "" ? description : DEFAULT_DESCRIPTION;
    meta.setAttribute("content", content);
  }, [description]);

  useEffect(() => {
    const path = canonicalPath !== undefined ? canonicalPath : (location.pathname + location.search);
    setCanonical(path);
  }, [canonicalPath, location.pathname, location.search]);

  useEffect(() => {
    const t = title != null && title !== "" ? title : document.title;
    const d = description != null && description !== "" ? description : DEFAULT_DESCRIPTION;
    setOgMeta(t, d, image);
  }, [title, description, image]);
}
