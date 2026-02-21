import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_API_URL: backend URL (default http://localhost:4000). Tạo file .env với VITE_API_URL=http://your-api.com
  envPrefix: "VITE_"
});
