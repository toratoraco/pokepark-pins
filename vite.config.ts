import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages のサブパス（https://<user>.github.io/pokepark-pins/）に合わせる
export default defineConfig({
  base: "/pokepark-pins/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        cleanupOutdatedCaches: true,
        // 同期APIとPokeAPIの画像はキャッシュしない（同期はオンライン時のみでよい）
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: "ピンズコレクション",
        short_name: "ピンズ",
        description: "ポケモンピンバッジの収集記録",
        lang: "ja",
        display: "standalone",
        start_url: ".",
        scope: ".",
        theme_color: "#e3350d",
        background_color: "#ffffff",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
