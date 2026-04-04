import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      "/api": "http://localhost:5199",
    },
  },
  build: {
    outDir: "../KeyMagic.Service/wwwroot",
    emptyOutDir: true,
    sourcemap: true,
  },
});
