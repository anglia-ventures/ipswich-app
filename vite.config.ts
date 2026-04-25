import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const ghostUrl = (env.VITE_GHOST_URL || "https://www.ipswich.co.uk").replace(
    /\/$/,
    "",
  );

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? { protocol: "ws", host, port: 1421 }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
      // Proxy Ghost APIs through the dev server so cookies, CORS, and
      // the Members API "Just Work" from http://localhost:1420.
      // The frontend uses relative URLs in dev (see src/config.ts).
      proxy: {
        "/ghost/api": {
          target: ghostUrl,
          changeOrigin: true,
          secure: true,
        },
        "/members/api": {
          target: ghostUrl,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: "localhost",
        },
      },
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    build: {
      target:
        process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
      minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
  };
});
