import dotenv from "dotenv";
dotenv.config();

export const PORT = Number(process.env.PORT || 4000);
export const FRONTEND = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
export const ORDER_PREFIX = (process.env.ORDER_PREFIX || "HS").toUpperCase();
export const BOOKING_CODE_PREFIX = (process.env.BOOKING_CODE_PREFIX || "NVH").toUpperCase();
export const sessionSecret = process.env.SESSION_SECRET || "dev_secret";
export const DEPOSIT_MIN = Number(process.env.DEPOSIT_MIN_PERCENT || 20);
export const DEPOSIT_MAX = Number(process.env.DEPOSIT_MAX_PERCENT || 30);
export const DEPOSIT_DEFAULT = Number(process.env.DEPOSIT_DEFAULT_PERCENT || 30);
