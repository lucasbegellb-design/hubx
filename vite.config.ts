import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import process from "node:process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "supabase/functions/_shared/logic"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  // Options spécifiques à Tauri (port fixe, pas d'effacement de la console)
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version) },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
}));
