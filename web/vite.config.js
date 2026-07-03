import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind on all interfaces (IPv4 0.0.0.0 + IPv6 ::) so the app is reachable at
    // 127.0.0.1:5173 as well as [::1]:5173. Without this, Vite binds IPv6-only and a
    // browser that resolves `localhost` to IPv4 gets "server not found".
    host: true,
    port: 5173,
    strictPort: true,
  },
});
