import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { db } from "../db.js";
import { parseTime } from "../helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, "..");

/** Resolve đường dẫn credentials: ưu tiên từ thư mục backend (tránh lỗi khi PM2 chạy từ project root). */
function resolveCredPath(credPath) {
  if (!credPath) return null;
  const fromCwd = path.resolve(process.cwd(), credPath);
  const fromBackend = path.resolve(BACKEND_DIR, credPath);
  if (fs.existsSync(fromBackend)) return fromBackend;
  return fromCwd;
}

function normalizeTimeStr(s) {
  const t = parseTime(s);
  if (t == null) return null;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Chuẩn hóa ngày từ Sheet: chuỗi (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY) hoặc số serial (Google/Excel) → YYYY-MM-DD. */
function parseSheetDate(val) {
  if (val == null || val === "") return null;
  if (typeof val === "number") {
    const serial = Math.floor(Number(val));
    if (serial < 1) return null;
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

export async function fetchGoogleSheetBookings() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A2:F500";
  const credPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
  if (!spreadsheetId || !credPath) {
    console.warn("[GoogleSheets] fetch skipped: MISSING_CONFIG (SPREADSHEET_ID hoặc CREDENTIALS_PATH)");
    return { ok: false, rows: [], error: "MISSING_CONFIG", rawRowCount: 0 };
  }

  const resolvedPath = resolveCredPath(credPath);
  if (!resolvedPath) {
    console.warn("[GoogleSheets] CREDENTIALS_READ_FAIL: không tìm thấy file", credPath);
    return { ok: false, rows: [], error: "CREDENTIALS_READ_FAIL", rawRowCount: 0 };
  }
  let cred;
  try {
    const raw = fs.readFileSync(resolvedPath, "utf8");
    cred = JSON.parse(raw);
  } catch (e) {
    console.warn("[GoogleSheets] CREDENTIALS_READ_FAIL:", e?.message || e);
    return { ok: false, rows: [], error: "CREDENTIALS_READ_FAIL", rawRowCount: 0 };
  }

  const auth = new google.auth.GoogleAuth({
    credentials: cred,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
  const sheets = google.sheets({ version: "v4", auth });
  let data;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    data = res.data.values || [];
  } catch (e) {
    const errMsg = String(e?.message || e);
    console.warn("[GoogleSheets] fetch failed:", errMsg, "| range:", range);
    return { ok: false, rows: [], error: errMsg, rawRowCount: 0 };
  }

  const rawRowCount = data.length;
  if (rawRowCount === 0) {
    console.warn("[GoogleSheets] Sheet trả về 0 dòng. Kiểm tra: range=", range, "| Có dữ liệu từ dòng 2 trong Sheet chưa?");
  }

  const roomsByName = new Map();
  for (const r of db.prepare("SELECT id, name FROM rooms").all()) {
    roomsByName.set(String(r.name || "").trim().toLowerCase(), r.id);
  }

  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const a = String(row[0] || "").trim();
    const bRaw = String(row[1] || "").trim();
    const cRaw = String(row[2] || "").trim();
    const d = String(row[3] || "").trim().toLowerCase();
    const e = String(row[4] || "").trim();
    const f = String(row[5] || "").trim();
    if (!a || !bRaw) continue;
    const b = parseSheetDate(bRaw);
    if (!b) continue;

    let roomId = null;
    const num = Number(a);
    if (Number.isInteger(num) && num > 0) {
      const room = db.prepare("SELECT id FROM rooms WHERE id=?").get(num);
      if (room) roomId = room.id;
    }
    if (roomId == null) {
      roomId = roomsByName.get(a.toLowerCase()) ?? db.prepare("SELECT id FROM rooms WHERE LOWER(TRIM(name))=?").get(a.toLowerCase())?.id;
    }
    if (!roomId) continue;

    const startTime = normalizeTimeStr(e);
    const endTime = normalizeTimeStr(f);
    const isHourly = startTime && endTime && parseTime(e) < parseTime(f);

    if (isHourly) {
      rows.push({
        room_id: roomId,
        check_in: b,
        check_out: b,
        check_in_time: startTime,
        check_out_time: endTime,
        status: d === "pending" ? "pending" : "confirmed",
        booking_type: "hourly"
      });
    } else {
      const c = parseSheetDate(cRaw);
      if (!c) continue;
      if (b >= c) continue;
      rows.push({
        room_id: roomId,
        check_in: b,
        check_out: c,
        check_in_time: null,
        check_out_time: null,
        status: d === "pending" ? "pending" : "confirmed",
        booking_type: "overnight"
      });
    }
  }

  console.log("[GoogleSheets] fetch OK: range=", range, "| raw rows=", rawRowCount, "| parsed=", rows.length);
  return { ok: true, rows, rawRowCount };
}

export function syncGoogleSheetToBookings() {
  return fetchGoogleSheetBookings().then(({ ok, rows, error, rawRowCount = 0 }) => {
    if (!ok) {
      return { synced: 0, error, fetched: 0, rawRowCount };
    }
    if (rows.length === 0 && rawRowCount > 0) {
      console.warn("[GoogleSheets] Tất cả", rawRowCount, "dòng bị bỏ qua. Kiểm tra: Cột A = tên phòng hoặc ID (trùng với app); B,C = ngày (2026-04-29 hoặc 29-04-2026); D = pending hoặc confirmed.");
    }

    db.prepare("DELETE FROM bookings WHERE source=?").run("google_sheet");

    const insert = db.prepare(`
      INSERT INTO bookings (
        room_id, user_id, full_name, phone, email,
        check_in, check_out, guests, note, booking_type, check_in_time, check_out_time,
        status, payment_method, payment_status,
        total_amount, paid_amount, deposit_percent, deposit_amount,
        lookup_code, source
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, 1, '', ?, ?, ?, ?, ?, 'sepay', 'paid', 0, 0, 0, 0, ?, 'google_sheet')
    `);

    let synced = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.room_id) continue;
      const lookup = "GS-" + r.room_id + "-" + r.check_in + (r.check_in_time ? "-" + r.check_in_time : "") + "-" + i;
      try {
        insert.run(
          r.room_id,
          "(Google Sheet)",
          "-",
          "",
          r.check_in,
          r.check_out,
          r.booking_type || "overnight",
          r.check_in_time || null,
          r.check_out_time || null,
          r.status,
          lookup
        );
        synced++;
      } catch (e) {
        console.warn("[GoogleSheets] sync row failed:", e?.message || e);
      }
    }
    console.log("[GoogleSheets] Sheet→Web: đã xóa booking từ Sheet cũ, insert", synced, "dòng. Lịch web sẽ chặn các ngày tương ứng.");
    if (synced === 0 && rawRowCount > 0) {
      console.warn("[GoogleSheets] Không insert được dòng nào. Kiểm tra cột A (tên phòng phải trùng với phòng trong app).");
    }
    return { synced, error: null, fetched: rows.length, rawRowCount };
  });
}

export async function pushBookingsToGoogleSheet() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const webRange = process.env.GOOGLE_SHEETS_WEB_RANGE || "Web!A2:F500";
  const credPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
  if (!spreadsheetId || !credPath) return { ok: false, error: "MISSING_CONFIG" };

  const resolvedPath = resolveCredPath(credPath);
  if (!resolvedPath) return { ok: false, error: "CREDENTIALS_READ_FAIL" };
  let cred;
  try {
    const raw = fs.readFileSync(resolvedPath, "utf8");
    cred = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: "CREDENTIALS_READ_FAIL" };
  }

  const auth = new google.auth.GoogleAuth({
    credentials: cred,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const sheets = google.sheets({ version: "v4", auth });

  const rows = db.prepare(`
    SELECT b.room_id, r.name AS room_name, b.check_in, b.check_out, b.status, b.booking_type, b.check_in_time, b.check_out_time
    FROM bookings b JOIN rooms r ON r.id = b.room_id
    WHERE b.source = 'web' AND b.status IN ('pending', 'confirmed')
    ORDER BY b.check_in, b.room_id
  `).all();

  const values = rows.map((b) => {
    const room = b.room_name || String(b.room_id);
    const ci = b.check_in || "";
    const co = b.check_out || "";
    const status = (b.status || "pending").toLowerCase();
    const isHourly = String(b.booking_type || "").toLowerCase() === "hourly";
    const e = isHourly ? (b.check_in_time || "") : "";
    const f = isHourly ? (b.check_out_time || "") : "";
    return [room, ci, co, status, e, f];
  });

  try {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: webRange });
    if (values.length > 0) {
      const rangeMatch = webRange.match(/^([^!]+)!([A-Z]+)(\d+)/);
      const sheetPart = rangeMatch ? rangeMatch[1] : "Web";
      const startRow = rangeMatch ? parseInt(rangeMatch[3], 10) : 2;
      const endRow = startRow + values.length - 1;
      const updateRange = `${sheetPart}!A${startRow}:F${endRow}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updateRange,
        valueInputOption: "RAW",
        requestBody: { values }
      });
    }
    console.log("[GoogleSheets] push OK →", webRange, "rows:", values.length);
    return { ok: true, count: values.length };
  } catch (e) {
    const errMsg = String(e?.message || e);
    console.warn("[GoogleSheets] push failed:", errMsg, "| range:", webRange);
    return { ok: false, error: errMsg };
  }
}

export function schedulePushToGoogleSheet() {
  setImmediate(() => {
    pushBookingsToGoogleSheet()
      .then(({ ok, error }) => {
        if (!ok) console.warn("[GoogleSheets] push to sheet failed:", error);
      })
      .catch((e) => console.warn("[GoogleSheets] push error:", e?.message || e));
  });
}
