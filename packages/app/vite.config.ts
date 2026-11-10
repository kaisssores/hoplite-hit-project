import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const serverPort = process.env.TETHER_PORT ?? "4096";
const proxy = { "/v1": { target: `http://127.0.0.1:${serverPort}` } };

// The client is served on its own port and reaches the Tether server through /v1,
// so the browser sees one origin and the event stream needs no CORS.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true, allowedHosts: true, proxy },
  preview: { host: true, port: 5173, allowedHosts: true, proxy },
});
