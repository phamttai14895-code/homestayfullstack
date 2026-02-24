import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { db, hasColumn } from "../db.js";
import { parseTime, cleanupExpiredSepay } from "../helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, "..");

/** Resolve đường dẫn credentials. */
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

/** Chuẩn hóa ngày từ Sheet: chuỗi (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY) hoặc số serial → YYYY-MM-DD. */
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

/** dd/mm trong tháng/year → YYYY-MM-DD (d,m là string). */
function ddmmyyToIso(d, m, year) {
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DAY_NAMES_VI = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

/** Tháng/năm báo cáo: env GOOGLE_SHEETS_REPORT_MONTH (YYYY-MM) hoặc tháng hiện tại. */
function getReportMonthYear() {
  const env = process.env.GOOGLE_SHEETS_REPORT_MONTH || "";
  const m = env.match(/^(\d{4})-(\d{2})$/);
  if (m) return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Parse ô: "Tên | Qua đêm dd/mm-dd/mm" hoặc "Tên | Theo giờ HH:mm-HH:mm", phần cuối có thể "Đã TT" hoặc "Chờ TT". */
function parseReportCell(text, reportYear) {
  const s = String(text || "").trim();
  if (!s) return null;
  const parts = s.split(/\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const fullName = parts[0];
  const typePart = parts[1];
  const hasPaid = /Đã\s*TT/i.test(s);
  const status = hasPaid ? "confirmed" : "pending";

  const overnightMatch = typePart.match(/Qua đêm\s+(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})/i);
  if (overnightMatch) {
    const [, d1, m1, d2, m2] = overnightMatch;
    const checkIn = ddmmyyToIso(d1, m1, reportYear);
    const checkOut = ddmmyyToIso(d2, m2, reportYear);
    if (!checkIn || !checkOut) return null;
    const nextDay = new Date(checkOut + "T12:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    const checkOutExclusive = nextDay.toISOString().slice(0, 10);
    return { fullName, booking_type: "overnight", check_in: checkIn, check_out: checkOutExclusive, check_in_time: null, check_out_time: null, status };
  }
  const hourlyMatch = typePart.match(/Theo giờ\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/i) || typePart.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (hourlyMatch) {
    const t1 = normalizeTimeStr(hourlyMatch[1]);
    const t2 = normalizeTimeStr(hourlyMatch[2]);
    if (t1 && t2) return { fullName, booking_type: "hourly", check_in_time: t1, check_out_time: t2, check_in: null, check_out: null, status };
  }
  return null;
}

/** Đọc bảng báo cáo: row 0 = header (A3:M3), rows 1-31 = ngày 1-31. data[0] = row 3 trong Sheet (tên phòng). */
export async function fetchGoogleSheetBookings() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const reportRange = (process.env.GOOGLE_SHEETS_REPORT_RANGE || "").trim();
  const listRange = process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A2:F500";
  const credPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
  if (!spreadsheetId || !credPath) {
    return { ok: false, rows: [], error: "MISSING_CONFIG", rawRowCount: 0 };
  }

  const resolvedPath = resolveCredPath(credPath);
  if (!resolvedPath) return { ok: false, rows: [], error: "CREDENTIALS_READ_FAIL", rawRowCount: 0 };
  let cred;
  try {
    cred = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } catch (e) {
    return { ok: false, rows: [], error: "CREDENTIALS_READ_FAIL", rawRowCount: 0 };
  }

  const auth = new google.auth.GoogleAuth({
    credentials: cred,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
  const sheets = google.sheets({ version: "v4", auth });

  const roomsByName = new Map();
  for (const r of db.prepare("SELECT id, name FROM rooms").all()) {
    roomsByName.set(String(r.name || "").trim().toLowerCase(), r.id);
  }

  /** Cột C3:M3 có thể là "609 HHGT (2 ngủ 2 wc)" hoặc "609 HHGT (2 ngủ 2 wc) (id:4)" → map về room_id. */
  function resolveRoomIdFromSheetCell(cellValue) {
    const s = String(cellValue || "").trim();
    if (!s) return null;
    const idMatch = s.match(/\s*\(id\s*:\s*(\d+)\)\s*$/i) || s.match(/\s*\(id\s*=\s*(\d+)\)\s*$/i);
    if (idMatch) {
      const room = db.prepare("SELECT id FROM rooms WHERE id=?").get(parseInt(idMatch[1], 10));
      if (room) return room.id;
    }
    const lower = s.toLowerCase();
    if (roomsByName.has(lower)) return roomsByName.get(lower);
    const byTrim = db.prepare("SELECT id FROM rooms WHERE LOWER(TRIM(name))=?").get(lower);
    if (byTrim) return byTrim.id;
    for (const [name, id] of roomsByName) {
      if (name.indexOf(lower) === 0 || lower.indexOf(name) === 0) return id;
    }
    return null;
  }

  if (reportRange) {
    const { year, month } = getReportMonthYear();
    const match = reportRange.match(/^([^!]+)!/);
    const sheetName = match ? match[1] : "Sheet1";
    const rangeStr = `${sheetName}!A3:M34`;
    let gridData;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rangeStr,
        dateTimeRenderOption: "FORMATTED_STRING"
      });
      gridData = res.data.values || [];
    } catch (e) {
      return { ok: false, rows: [], error: e?.message || "FETCH_FAIL", rawRowCount: 0 };
    }
    if (gridData.length < 4) return { ok: true, rows: [], rawRowCount: gridData.length };

    const roomNames = (gridData[0] || []).slice(2, 13);
    const reportRows = [];
    const seenOvernight = new Set();

    for (let r = 1; r <= 31 && r < gridData.length; r++) {
      const row = gridData[r] || [];
      const dayOfMonth = r;
      const dateIso = `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
      for (let col = 0; col < roomNames.length; col++) {
        const roomName = String(roomNames[col] || "").trim();
        const roomId = resolveRoomIdFromSheetCell(roomName);
        if (!roomId) continue;
        const cell = String(row[col + 2] || "").trim();
        const lines = cell.split(/\n/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const parsed = parseReportCell(line, year);
          if (!parsed) continue;
          if (parsed.booking_type === "hourly") {
            reportRows.push({
            room_id: roomId,
            full_name: parsed.fullName,
            check_in: dateIso,
            check_out: dateIso,
            check_in_time: parsed.check_in_time,
            check_out_time: parsed.check_out_time,
            status: parsed.status || "confirmed",
            booking_type: "hourly"
          });
        } else {
          const key = `${roomId}-${parsed.check_in}-${parsed.check_out}-${parsed.fullName}`;
          if (seenOvernight.has(key)) continue;
          seenOvernight.add(key);
          reportRows.push({
            room_id: roomId,
            full_name: parsed.fullName,
            check_in: parsed.check_in,
            check_out: parsed.check_out,
            check_in_time: null,
            check_out_time: null,
            status: parsed.status || "confirmed",
            booking_type: "overnight"
          });
        }
      }
    }
  }
    console.log("[GoogleSheets] fetch Report OK: parsed", reportRows.length, "bookings from grid");
    return { ok: true, rows: reportRows, rawRowCount: gridData.length, source: "report" };
  }

  const range = listRange;
  let listData;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    listData = res.data.values || [];
  } catch (e) {
    return { ok: false, rows: [], error: e?.message || "FETCH_FAIL", rawRowCount: 0 };
  }

  const rawRowCount = listData.length;
  const listRows = [];
  for (let i = 0; i < listData.length; i++) {
    const row = listData[i];
    const a = String(row[0] || "").trim();
    const bRaw = String(row[1] || "").trim();
    const cRaw = String(row[2] || "").trim();
    const d = String(row[3] || "").trim().toLowerCase();
    const nameRaw = String(row[4] || "").trim();
    const e = String(row[5] || "").trim();
    const f = String(row[6] || "").trim();
    if (!a || !bRaw) continue;
    const b = parseSheetDate(bRaw);
    if (!b) continue;

    let roomId = null;
    const num = Number(a);
    if (Number.isInteger(num) && num > 0) {
      const room = db.prepare("SELECT id FROM rooms WHERE id=?").get(num);
      if (room) roomId = room.id;
    }
    if (roomId == null) roomId = roomsByName.get(a.toLowerCase()) ?? db.prepare("SELECT id FROM rooms WHERE LOWER(TRIM(name))=?").get(a.toLowerCase())?.id;
    if (!roomId) continue;

    const startTime = normalizeTimeStr(e);
    const endTime = normalizeTimeStr(f);
    const isHourly = startTime && endTime && parseTime(e) < parseTime(f);
    const fullName = nameRaw || "(Google Sheet)";

    if (isHourly) {
      listRows.push({
        room_id: roomId,
        full_name: fullName,
        check_in: b,
        check_out: b,
        check_in_time: startTime,
        check_out_time: endTime,
        status: d === "pending" ? "pending" : "confirmed",
        booking_type: "hourly"
      });
    } else {
      const c = parseSheetDate(cRaw);
      if (!c || b >= c) continue;
      listRows.push({
        room_id: roomId,
        full_name: fullName,
        check_in: b,
        check_out: c,
        check_in_time: null,
        check_out_time: null,
        status: d === "pending" ? "pending" : "confirmed",
        booking_type: "overnight"
      });
    }
  }
  console.log("[GoogleSheets] fetch List OK: range=", range, "| parsed=", listRows.length);
  return { ok: true, rows: listRows, rawRowCount, source: "list" };
}

export function syncGoogleSheetToBookings() {
  cleanupExpiredSepay();
  return fetchGoogleSheetBookings().then(({ ok, rows, error, rawRowCount = 0, source = "list" }) => {
    if (!ok) return { synced: 0, error, fetched: 0, rawRowCount, source };

    if (hasColumn(db, "bookings", "source")) {
      db.prepare("DELETE FROM bookings WHERE source=?").run("google_sheet");
    }

    const tableCols = db.prepare("PRAGMA table_info(bookings)").all().map((r) => r.name);
    const baseCols = ["room_id", "user_id", "full_name", "phone", "email", "check_in", "check_out", "guests", "note", "status", "payment_method", "payment_status", "total_amount", "paid_amount", "lookup_code"];
    const insertCols = baseCols.filter((c) => tableCols.includes(c));
    const placeholders = insertCols.map(() => "?").join(", ");
    const insert = db.prepare(`INSERT INTO bookings (${insertCols.join(", ")}) VALUES (${placeholders})`);
    const setSource = hasColumn(db, "bookings", "source") ? db.prepare("UPDATE bookings SET source='google_sheet' WHERE id=?") : null;
    const setBookingType = hasColumn(db, "bookings", "booking_type") ? db.prepare("UPDATE bookings SET booking_type=? WHERE id=?") : null;
    const setTimes = hasColumn(db, "bookings", "check_in_time") ? db.prepare("UPDATE bookings SET check_in_time=?, check_out_time=? WHERE id=?") : null;

    const valueFor = (col, r, lookup) => {
      const isConfirmed = (r.status || "").toLowerCase() === "confirmed";
      const v = {
        room_id: r.room_id,
        user_id: null,
        full_name: r.full_name || "(Google Sheet)",
        phone: "-",
        email: "",
        check_in: r.check_in,
        check_out: r.check_out,
        guests: 1,
        note: "",
        status: r.status || "pending",
        payment_method: "sepay",
        payment_status: isConfirmed ? "paid" : "unpaid",
        total_amount: 0,
        paid_amount: 0,
        lookup_code: lookup
      };
      return v[col];
    };

    const hasSource = hasColumn(db, "bookings", "source");
    const existingWebStmt = hasSource ? db.prepare("SELECT 1 FROM bookings WHERE room_id=? AND check_in=? AND TRIM(full_name)=? AND source='web'") : null;

    let synced = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.room_id) continue;
      if (existingWebStmt && existingWebStmt.get(r.room_id, r.check_in, String(r.full_name || "").trim())) continue;
      const lookup = "GS-" + r.room_id + "-" + r.check_in + (r.check_in_time ? "-" + r.check_in_time : "") + "-" + i;
      try {
        const vals = insertCols.map((c) => valueFor(c, r, lookup));
        const info = insert.run(...vals);
        const id = info.lastInsertRowid;
        if (id) {
          if (setSource) setSource.run(id);
          if (setBookingType) setBookingType.run(r.booking_type || "overnight", id);
          if (setTimes) setTimes.run(r.check_in_time || null, r.check_out_time || null, id);
        }
        synced++;
      } catch (e) {
        console.warn("[GoogleSheets] sync row failed:", e?.message || e);
      }
    }
    console.log("[GoogleSheets] Sheet→Web: inserted", synced, "bookings");
    return { synced, error: null, fetched: rows.length, rawRowCount, source };
  });
}

/** Ghi bảng lịch: A4:A34=ngày, B4:B34=thứ, C3:M3=tên phòng, C4:M34=nội dung. Gồm đơn confirmed+đã TT và đơn pending; đơn hết hạn (đã hủy) không ghi → xóa khỏi sheet. */
export async function pushBookingsToGoogleSheet() {
  cleanupExpiredSepay();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const reportRange = (process.env.GOOGLE_SHEETS_REPORT_RANGE || "").trim();
  const webRange = process.env.GOOGLE_SHEETS_WEB_RANGE || "Web!A2:G500";
  const credPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
  if (!spreadsheetId || !credPath) return { ok: false, error: "MISSING_CONFIG" };

  const resolvedPath = resolveCredPath(credPath);
  if (!resolvedPath) return { ok: false, error: "CREDENTIALS_READ_FAIL" };
  let cred;
  try {
    cred = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } catch (e) {
    return { ok: false, error: "CREDENTIALS_READ_FAIL" };
  }

  const auth = new google.auth.GoogleAuth({
    credentials: cred,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const sheets = google.sheets({ version: "v4", auth });

  const { year, month } = getReportMonthYear();
  const rooms = db.prepare("SELECT id, name FROM rooms ORDER BY id").all();
  const roomColCount = Math.min(11, rooms.length);
  const roomIdToIndex = new Map(rooms.slice(0, roomColCount).map((r, i) => [r.id, i]));

  const bookings = db.prepare(`
    SELECT b.room_id, b.full_name, b.check_in, b.check_out, b.booking_type, b.check_in_time, b.check_out_time,
           b.status, b.payment_status, b.paid_amount, b.total_amount
    FROM bookings b
    WHERE (b.status = 'confirmed' AND (b.payment_status = 'paid' OR b.paid_amount >= b.total_amount))
       OR b.status = 'pending'
    ORDER BY b.check_in, b.room_id
  `).all();

  const statusStr = (b) => String(b.status || "").toLowerCase();
  const isPaidBooking = (b) =>
    statusStr(b) === "confirmed" &&
    (String(b.payment_status || "").toLowerCase() === "paid" ||
      (b.paid_amount != null && b.total_amount != null && Number(b.paid_amount) >= Number(b.total_amount)));

  const overnightKey = (b) => `${b.room_id}|${String(b.full_name || "").trim()}|${b.check_in}`;
  const overnightMap = new Map();
  const hourlyList = [];
  for (const b of bookings) {
    const isOvernight = String(b.booking_type || "").toLowerCase() !== "hourly";
    if (!isOvernight) {
      hourlyList.push(b);
      continue;
    }
    const key = overnightKey(b);
    if (!overnightMap.has(key) || (b.check_out || "") > (overnightMap.get(key).check_out || "")) {
      overnightMap.set(key, b);
    }
  }
  const dedupedBookings = [...hourlyList, ...overnightMap.values()].sort(
    (a, b) => (a.check_in || "").localeCompare(b.check_in || "") || (a.room_id - b.room_id)
  );

  const grid = [];
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month - 1, day);
    const dow = DAY_NAMES_VI[d.getDay()];
    const row = [day, dow];
    for (let col = 0; col < roomColCount; col++) row.push("");
    grid.push(row);
  }

  for (const b of dedupedBookings) {
    const colIndex = roomIdToIndex.get(b.room_id);
    if (colIndex == null) continue;
    const ci = b.check_in || "";
    const co = b.check_out || "";
    const isHourly = String(b.booking_type || "").toLowerCase() === "hourly";
    const name = String(b.full_name || "").trim() || "Khách";
    const statusLabel = statusStr(b) === "pending" ? "Chờ TT" : (isPaidBooking(b) ? "Đã TT" : "Chờ TT");

    if (isHourly && b.check_in_time && b.check_out_time) {
      const [y, m, d] = ci.split("-");
      const dayNum = parseInt(d, 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const cellText = `${name} | Theo giờ ${b.check_in_time}-${b.check_out_time} | ${statusLabel}`;
        const rowIndex = dayNum - 1;
        const cur = grid[rowIndex][colIndex + 2];
        if (cur === "") grid[rowIndex][colIndex + 2] = cellText;
        else if (!cur.includes(cellText)) grid[rowIndex][colIndex + 2] += "\n" + cellText;
      }
    } else {
      const ciDate = parseSheetDate(ci);
      const coDate = parseSheetDate(co);
      if (!ciDate || !coDate) continue;
      const [y1, m1, d1] = ciDate.split("-").map(Number);
      const [y2, m2, d2] = coDate.split("-").map(Number);
      if (y1 !== year || m1 !== month || y2 !== year || m2 !== month) continue;
      const ciDay = d1;
      const coDayExclusive = new Date(coDate);
      coDayExclusive.setDate(coDayExclusive.getDate() - 1);
      const coDay = coDayExclusive.getDate();
      const ciFmt = (() => { const [y, m, d] = (ci || "").split("-"); return d && m ? `${d}/${m}` : ci; })();
      const coFmt = (() => { const [y, m, d] = (co || "").split("-"); return d && m ? `${d}/${m}` : co; })();
      const cellText = `${name} | Qua đêm ${ciFmt}-${coFmt} | ${statusLabel}`;
      for (let day = ciDay; day <= coDay; day++) {
        if (day < 1 || day > 31) continue;
        const rowIndex = day - 1;
        const cur = grid[rowIndex][colIndex + 2];
        if (cur === "") grid[rowIndex][colIndex + 2] = cellText;
        else if (!cur.includes(cellText)) grid[rowIndex][colIndex + 2] += "\n" + cellText;
      }
    }
  }

  if (reportRange) {
    const match = reportRange.match(/^([^!]+)!/);
    const sheetName = match ? match[1] : "Sheet1";
    console.log("[GoogleSheets] push mode: REPORT →", sheetName, "| A4:M34 (bảng lịch)");
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!C4:M34`
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!C3:M3`,
        valueInputOption: "RAW",
        requestBody: { values: [rooms.slice(0, roomColCount).map((r) => r.name || "")] }
      });
      const a34 = grid.map((row) => [row[0], row[1]]);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A4:B34`,
        valueInputOption: "RAW",
        requestBody: { values: a34 }
      });
      const dataGrid = grid.map((row) => row.slice(2));
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!C4:M34`,
        valueInputOption: "RAW",
        requestBody: { values: dataGrid }
      });
      console.log("[GoogleSheets] push Report OK:", sheetName, "rows 4-34");
      return { ok: true, count: grid.length };
    } catch (e) {
      console.warn("[GoogleSheets] push Report failed:", e?.message || e);
      return { ok: false, error: e?.message || "PUSH_FAIL" };
    }
  }

  console.log("[GoogleSheets] push mode: LIST →", webRange, "(dòng đơn A:G)");
  const rows = db.prepare(`
    SELECT b.room_id, r.name AS room_name, b.full_name, b.check_in, b.check_out, b.status, b.booking_type, b.check_in_time, b.check_out_time
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
    const name = String(b.full_name || "").trim() || "";
    return [room, ci, co, status, name, isHourly ? (b.check_in_time || "") : "", isHourly ? (b.check_out_time || "") : ""];
  });

  try {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: webRange });
    if (values.length > 0) {
      const rangeMatch = webRange.match(/^([^!]+)!([A-Z]+)(\d+)/);
      const sheetPart = rangeMatch ? rangeMatch[1] : "Web";
      const startRow = rangeMatch ? parseInt(rangeMatch[3], 10) : 2;
      const endRow = startRow + values.length - 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetPart}!A${startRow}:G${endRow}`,
        valueInputOption: "RAW",
        requestBody: { values }
      });
    }
    console.log("[GoogleSheets] push List OK →", webRange, "rows:", values.length);
    return { ok: true, count: values.length };
  } catch (e) {
    console.warn("[GoogleSheets] push failed:", e?.message || e);
    return { ok: false, error: e?.message || "PUSH_FAIL" };
  }
}

export function schedulePushToGoogleSheet() {
  setImmediate(() => {
    pushBookingsToGoogleSheet()
      .then(({ ok, error }) => {
        if (!ok) console.warn("[GoogleSheets] push failed:", error);
      })
      .catch((e) => console.warn("[GoogleSheets] push error:", e?.message || e));
  });
}
