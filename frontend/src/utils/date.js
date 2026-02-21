function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Format chuỗi YYYY-MM-DD thành dd-mm-yyyy */
export function fmtDDMMYYYYFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Số đêm giữa check_in và check_out (ISO date string) */
export function nightsBetween(ciISO, coISO) {
  const a = new Date(ciISO + "T00:00:00");
  const b = new Date(coISO + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 86400000));
}
