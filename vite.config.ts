import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The web app runs on 5173 and proxies /api to the Express server on 8787,
// which holds the Anthropic API key so it never reaches the browser.
// WEB_PORT and PORT override both (the browser tests use their own so they never touch a running dev server).
const webPort = Number(process.env.WEB_PORT || 5173);
const apiPort = Number(process.env.PORT || 8787);

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    strictPort: !!process.env.WEB_PORT,
    proxy: { "/api": { target: `http://localhost:${apiPort}`, changeOrigin: true } },
  },
});
