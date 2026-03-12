import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { aibridgeLocalApiPlugin } from "./aibridge/runtime/vite-plugin";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), aibridgeLocalApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
