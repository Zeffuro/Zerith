import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import editorPackage from "./package.json" with { type: "json" };

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const id_ = String(id);
          if (!id_.includes('node_modules')) return;

          if (id_.includes('monaco-editor') || id_.includes('@monaco-editor')) {
            return 'vendor-monaco';
          }

          if (id_.includes('flexlayout-react')) {
            return 'vendor-flexlayout';
          }

          if (id_.includes('react-dom') || id_.includes('react')) {
            return 'vendor-react';
          }

          if (id_.includes('pixi.js') || id_.includes('@pixi')) {
            return 'vendor-pixi';
          }

          if (id_.includes('lucide-react')) {
            return 'vendor-icons';
          }
        }
      }
    }
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  define: {
    __ZERITH_EDITOR_VERSION__: JSON.stringify(editorPackage.version),
  },

  plugins: [react()],
  server: {
    hmr: host
      ? {
          host,
          port: 1421,
          protocol: "ws",
        }
      : undefined,
    host: host || false,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
