import { Router } from "express";
import { db, decorateRoom } from "../db.js";
import { requireLogin } from "../middleware.js";

const router = Router();

/** GET /api/wishlist — danh sách phòng trong wishlist (đã đăng nhập). */
router.get("/wishlist", requireLogin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.* FROM rooms r
    INNER JOIN wishlists w ON w.room_id = r.id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(req.user.id);

  const agg = db.prepare(`
    SELECT room_id, AVG(stars) AS avg_stars, COUNT(*) AS cnt
    FROM reviews GROUP BY room_id
  `).all();
  const byRoom = {};
  for (const a of agg) {
    byRoom[a.room_id] = {
      average_stars: Math.round(Number(a.avg_stars) * 10) / 10,
      review_count: Number(a.cnt)
    };
  }

  const rooms = rows.map((r) => {
    const d = decorateRoom(r);
    const x = byRoom[r.id];
    return { ...d, average_stars: x?.average_stars ?? null, review_count: x?.review_count ?? 0 };
  });

  res.json({ rooms, room_ids: rooms.map((r) => r.id) });
});

/** POST /api/wishlist/:roomId — thêm phòng vào wishlist. */
router.post("/wishlist/:roomId", requireLogin, (req, res) => {
  const roomId = Number(req.params.roomId);
  const room = db.prepare(`SELECT id FROM rooms WHERE id=?`).get(roomId);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  try {
    db.prepare(`INSERT INTO wishlists (user_id, room_id) VALUES (?, ?)`).run(req.user.id, roomId);
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
      return res.json({ added: true, room_id: roomId });
    }
    throw e;
  }
  res.status(201).json({ added: true, room_id: roomId });
});

/** DELETE /api/wishlist/:roomId — xóa phòng khỏi wishlist. */
router.delete("/wishlist/:roomId", requireLogin, (req, res) => {
  const roomId = Number(req.params.roomId);
  const result = db.prepare(`DELETE FROM wishlists WHERE user_id=? AND room_id=?`).run(req.user.id, roomId);
  res.json({ removed: result.changes > 0, room_id: roomId });
});

export default router;
