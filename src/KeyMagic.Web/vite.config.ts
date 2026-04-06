import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:5199",
    },
  },
  build: {
    outDir: "../KeyMagic.Service/wwwroot",
    emptyOutDir: true,
    sourcemap: mode !== "production",
  },
}));
