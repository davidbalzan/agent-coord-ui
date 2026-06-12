import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";

// XR headset dev over LAN without a cable (Phase 10 T4.1): WebXR needs a
// secure context, so XR_HTTPS=1 serves the dev app over self-signed HTTPS on
// all interfaces. The /ws proxy lets the headset reach the API's WebSocket
// through the same TLS origin (a secure page may not open plain ws:// to
// another host) — pair it with VITE_WS_URL=wss://<mac-ip>:5173/ws.
// Default dev flow (no XR_HTTPS) is unchanged.
const xrHttps = process.env["XR_HTTPS"] === "1";

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(xrHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["three"],
  },
  server: {
    port: 5173,
    host: xrHttps ? true : undefined,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        rewrite: (p) => p.replace(/^\/ws/, ""),
      },
    },
  },
});
