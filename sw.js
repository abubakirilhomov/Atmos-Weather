// Меняй версию, когда обновляешь файлы приложения — старый кэш удалится
const VERSION = "atmos-v1";

// Файлы самого приложения (если какого-то нет — это не сломает установку)
const SHELL = [
  "./",
  "./index.html",
  "./main.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Внешние хосты, которые кэшируем «на лету» (стили, скрипты, шрифты, иконки погоды)
const CACHEABLE_HOSTS = [
  "cdn.jsdelivr.net",
  "unpkg.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "openweathermap.org"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Данные погоды (api.openweathermap.org) всегда идут напрямую в сеть
  if (url.hostname === "api.openweathermap.org") return;

  // Открытие страницы: сначала сеть, при отсутствии интернета — кэш
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return;

  // Остальное: отдаём из кэша сразу и обновляем его в фоне
  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok || response.type === "opaque") {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
