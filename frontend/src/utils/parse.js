/**
 * Helpers parse dùng chung (admin, room form, v.v.)
 */
export function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

export function parseAmenities(a) {
  if (Array.isArray(a)) return a;
  try {
    return JSON.parse(a || "[]");
  } catch {
    return [];
  }
}

export function parseUrls(u) {
  if (Array.isArray(u)) return u;
  try {
    return JSON.parse(u || "[]");
  } catch {
    return [];
  }
}
