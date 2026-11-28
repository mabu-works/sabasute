// 🖥️ サーバーステータス service worker：殻（HTML/CSS/JS/アイコン）だけをキャッシュする
// 🌐 status.json は常にネットワークから取りに行く（古い状況を見せないため）
const CACHE = "sabasute-v1";
const CORE = [
  "/",
  "/index.html",
  "/style.css",
  "/status-core.js",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// 📦 インストール時に殻だけをキャッシュする
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// 🧹 古いキャッシュを削除して有効化する
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 🌐 キャッシュを即返しつつ裏でネットワーク取得して更新する（stale-while-revalidate）
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.endsWith("/status.json")) return; // 常にネットワーク
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
