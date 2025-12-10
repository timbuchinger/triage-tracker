import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue()
  ],
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  server: {
    port: 5173,
    proxy: {
      // Forward frontend /api requests to the backend service inside docker-compose network
      // When running the frontend dev server in Docker, the backend service is reachable
      // at the hostname `api:3000` on the docker network.
      "/api": {
        target: "http://api:3000",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
