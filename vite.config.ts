import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "development" ? "/teachers-payrolls/" : "/",
  server: {
    host: "::",
    port: 3003,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": "http://localhost:3004",
    },
  },
  plugins: [react(), tailwindcss(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
