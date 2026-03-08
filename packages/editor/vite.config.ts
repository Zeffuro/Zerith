import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
            return 'vendor-monaco';
          }

          if (id.includes('flexlayout-react')) {
            return 'vendor-flexlayout';
          }

          if (id.includes('@tauri-apps')) {
            return 'vendor-tauri';
          }


          if (id.includes('pixi.js')) {
            return 'vendor-pixi';
          }

          if (id.includes('@pixi/sound')) {
            return 'vendor-pixi-sound';
          }

          if (id.includes('gsap')) {
            return 'vendor-gsap';
          }
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
