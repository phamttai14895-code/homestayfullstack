/**
 * Cập nhật canonical URL theo path (full URL = origin + path).
 * Gọi khi pathname thay đổi (vd. từ usePageTitle hoặc layout).
 */
export function setCanonical(path) {
  if (typeof window === "undefined") return;
  const base = window.location.origin;
  const href = path != null && path !== "" ? (path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : "/" + path}`) : base + window.location.pathname;
  let link = document.getElementById("canonical-link");
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    link.id = "canonical-link";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Đảm bảo thẻ meta og tồn tại và cập nhật nội dung.
 */
function ensureOgMeta(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

/**
 * Cập nhật Open Graph: og:title, og:description, og:image (optional).
 */
export function setOgMeta(title, description, image) {
  if (title != null && title !== "") ensureOgMeta("og:title", title);
  if (description != null && description !== "") ensureOgMeta("og:description", description);
  if (image != null && image !== "") ensureOgMeta("og:image", image.startsWith("http") ? image : `${typeof window !== "undefined" ? window.location.origin : ""}${image.startsWith("/") ? image : "/" + image}`);
}

const JSON_LD_ID = "application-ld-json-site";

/**
 * Chèn hoặc cập nhật script JSON-LD trong <head>.
 * data: object sẽ được JSON.stringify.
 */
export function setJsonLd(data) {
  if (typeof document === "undefined" || !data) return;
  let script = document.getElementById(JSON_LD_ID);
  if (!script) {
    script = document.createElement("script");
    script.id = JSON_LD_ID;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/**
 * Xóa script JSON-LD (khi chuyển trang không còn dùng).
 */
export function removeJsonLd() {
  const script = document.getElementById(JSON_LD_ID);
  if (script) script.remove();
}
