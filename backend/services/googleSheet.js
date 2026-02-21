import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { db } from "../db.js";
import { parseTime } from "../helpers.js";

function normalizeTimeStr(s) {
  const t = parseTime(s);
  if (t == null) return null;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function fetchGoogleSheetBookings() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A2:F500";
  const credPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
  if (!spreadsheetId || !credPath) return { ok: false, rows: [], error: "MISSING_CONFIG" };

  let cred;
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), credPath), "utf8");
    cred = JSON.parse(raw);
  } catch (e) {
    return { ok: false, rows: [], error: "CREDENTIALS_READ_FAIL" };
  }

  const auth = new google.auth.GoogleAuth({
    credentials: cred,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
  const sheets = google.sheets({ version: "v4", auth });
  let data;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    data = res.data.values || [];
  } catch (e) {
    return { ok: false, rows: [], error: String(e?.message || e) };
  }

  const roomsByName = new Map();
  for (const r of db.prepare("SELECT id, name FROM rooms").all()) {
    roomsByName.set(String(r.name || "").trim().toLowerCase(), r.id);
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const a = String(row[0] || "").trim();
    const b = String(row[1] || "").trim();
    const c = String(row[2] || "").trim();
    const d = String(row[3] || "").trim().toLowerCase();
    const e = String(row[4] || "").trim();
    const f = String(row[5] || "").trim();
    if (!a || !b) continue;
    if (!dateRe.test(b)) continue;

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
      if (!c || !dateRe.test(c)) continue;
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

  return { ok: true, rows };
}

export function syncGoogleSheetToBookings() {
  return fetchGoogleSheetBookings().then(({ ok, rows, error }) => {
    if (!ok) return { synced: 0, error };
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
    return { synced, error: null };
  });
}

export async function pushBookingsToGoogleSheet() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const webRange = process.env.GOOGLE_SHEETS_WEB_RANGE || "Web!A2:F500";
  const credPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;
  if (!spreadsheetId || !credPath || !webRange) return { ok: false, error: "MISSING_CONFIG" };

  let cred;
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), credPath), "utf8");
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
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: webRange,
        valueInputOption: "RAW",
        requestBody: { values }
      });
    }
    return { ok: true, count: values.length };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
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
