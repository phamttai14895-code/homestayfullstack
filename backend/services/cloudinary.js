import { v2 as cloudinary } from "cloudinary";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

let configured = false;

if (CLOUD_NAME && API_KEY && API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET
  });
  configured = true;
} else {
  console.warn("⚠️ Cloudinary chưa cấu hình. Đặt CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trong .env");
}

/** Kiểm tra Cloudinary đã cấu hình chưa */
export function isCloudinaryConfigured() {
  return configured;
}

/**
 * Upload buffer lên Cloudinary.
 * @param {Buffer} buffer - Buffer ảnh
 * @param {Object} options - { mimetype, folder }
 * @returns {Promise<{ url: string, public_id: string }>}
 */
export async function uploadBuffer(buffer, options = {}) {
  if (!configured) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "homestay",
        resource_type: "image"
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("UPLOAD_FAILED"));
          return;
        }
        resolve({
          url: result.secure_url,
          public_id: result.public_id
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Xóa ảnh trên Cloudinary theo public_id.
 * @param {string} publicId - public_id từ kết quả upload
 * @returns {Promise<void>}
 */
export async function deleteByPublicId(publicId) {
  if (!configured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (e) {
    console.warn("[Cloudinary] delete failed:", e?.message || e);
  }
}

/**
 * Lấy public_id từ URL Cloudinary để dùng cho destroy.
 * Hỗ trợ URL dạng: .../upload/v123/homestay/rooms/xxx.jpg hoặc .../upload/v123/f_auto/homestay/rooms/xxx.jpg
 */
export function getPublicIdFromUrl(url) {
  if (typeof url !== "string" || !url.includes("cloudinary.com")) return null;
  const m = url.match(/homestay\/[^/]+\/[^.]+(?=\.|$)/);
  return m ? m[0] : null;
}
