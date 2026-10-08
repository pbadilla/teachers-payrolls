import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: process.env.BASE_PATH ?? "/teachers-payrolls/",
  server: {
    host: "::",
    port: 3003,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/teachers-payrolls/api": {
        target: "http://localhost:3004",
        rewrite: (requestPath) => requestPath.replace(/^\/teachers-payrolls/, ""),
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
