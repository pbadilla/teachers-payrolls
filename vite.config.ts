import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/teachers-payrolls/",
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
  plugins: [react(), tailwindcss(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
