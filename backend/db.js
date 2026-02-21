import path from "path";
import Database from "better-sqlite3";

const dbFile = path.join(process.cwd(), process.env.DB_FILE || "data.sqlite");
export const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function hasColumn(database, table, col) {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all();
  const colLower = String(col).toLowerCase();
  return rows.some((r) => String(r.name || "").toLowerCase() === colLower);
}

export function migrateNewColumns() {
  if (!hasColumn(db, "rooms", "price_per_hour")) {
    db.prepare("ALTER TABLE rooms ADD COLUMN price_per_hour INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!hasColumn(db, "bookings", "total_amount")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN total_amount INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!hasColumn(db, "bookings", "paid_amount")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN paid_amount INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!hasColumn(db, "bookings", "lookup_code")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN lookup_code TEXT NOT NULL DEFAULT ''").run();
  }
  if (!hasColumn(db, "bookings", "payment_method")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'sepay'").run();
  }
  if (!hasColumn(db, "bookings", "payment_status")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'").run();
  }
  if (!hasColumn(db, "bookings", "booking_type")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'overnight'").run();
  }
  if (!hasColumn(db, "bookings", "deposit_percent")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN deposit_percent INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!hasColumn(db, "bookings", "deposit_amount")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN deposit_amount INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!hasColumn(db, "bookings", "remainder_payment_method")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN remainder_payment_method TEXT").run();
  }
  if (!hasColumn(db, "bookings", "check_in_time")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN check_in_time TEXT").run();
  }
  if (!hasColumn(db, "bookings", "check_out_time")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN check_out_time TEXT").run();
  }
  if (!hasColumn(db, "bookings", "source")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'web'").run();
  }
  if (!hasColumn(db, "bookings", "expires_at")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN expires_at TEXT").run();
  }
  if (!hasColumn(db, "bookings", "sepay_order_code")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN sepay_order_code TEXT").run();
  }
  if (!hasColumn(db, "bookings", "sepay_qr_url")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN sepay_qr_url TEXT").run();
  }
  if (!hasColumn(db, "bookings", "sepay_expired_at")) {
    db.prepare("ALTER TABLE bookings ADD COLUMN sepay_expired_at TEXT").run();
  }
  if (!hasColumn(db, "reviews", "image_urls")) {
    db.prepare("ALTER TABLE reviews ADD COLUMN image_urls TEXT").run();
  }
  if (!hasColumn(db, "reviews", "admin_reply")) {
    db.prepare("ALTER TABLE reviews ADD COLUMN admin_reply TEXT").run();
  }
  if (!hasColumn(db, "reviews", "admin_reply_at")) {
    db.prepare("ALTER TABLE reviews ADD COLUMN admin_reply_at TEXT").run();
  }
  if (!hasColumn(db, "users", "phone")) {
    db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
  }
  if (!hasColumn(db, "users", "date_of_birth")) {
    db.prepare("ALTER TABLE users ADD COLUMN date_of_birth TEXT").run();
  }
  if (!hasColumn(db, "users", "facebook_id")) {
    db.prepare("ALTER TABLE users ADD COLUMN facebook_id TEXT").run();
  }
  if (!hasColumn(db, "users", "password_hash")) {
    db.prepare("ALTER TABLE users ADD COLUMN password_hash TEXT").run();
  }
  if (!hasColumn(db, "users", "email_verified")) {
    db.prepare("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!hasColumn(db, "users", "verify_token")) {
    db.prepare("ALTER TABLE users ADD COLUMN verify_token TEXT").run();
  }
  if (!hasColumn(db, "users", "verify_token_expires")) {
    db.prepare("ALTER TABLE users ADD COLUMN verify_token_expires TEXT").run();
  }
}

export function parseJsonArray(s) {
  try {
    const a = JSON.parse(s || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function decorateRoom(r) {
  return {
    ...r,
    image_urls: parseJsonArray(r.image_urls),
    amenities: parseJsonArray(r.amenities)
  };
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT,
  email TEXT UNIQUE,
  name TEXT,
  avatar TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  price_per_night INTEGER NOT NULL DEFAULT 0,
  price_per_hour INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  image_urls TEXT,
  amenities TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  guests INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'sepay',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  total_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  lookup_code TEXT NOT NULL,
  expires_at TEXT,
  sepay_order_code TEXT,
  sepay_qr_url TEXT,
  sepay_expired_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_lookup ON bookings(lookup_code);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);

CREATE TABLE IF NOT EXISTS room_day_prices (
  room_id INTEGER NOT NULL,
  date_iso TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, date_iso),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_txn_id TEXT NOT NULL,
  booking_id INTEGER,
  amount INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_txn_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  stars INTEGER NOT NULL DEFAULT 5,
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_room ON reviews(room_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);

CREATE TABLE IF NOT EXISTS wishlists (
  user_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, room_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
`);

migrateNewColumns();

if (db.prepare(`SELECT COUNT(*) c FROM rooms`).get().c === 0) {
  db.prepare(`
    INSERT INTO rooms (name, location, price_per_night, price_per_hour, image_url, image_urls, amenities, description)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    "Homestay Deluxe",
    "Đà Lạt",
    750000,
    80000,
    "",
    JSON.stringify([]),
    JSON.stringify(["wifi", "kitchen", "parking"]),
    "Phòng đẹp, gần trung tâm, view chill."
  );
}
