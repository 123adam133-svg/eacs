/* ═══════════════════════════════════════════════════════════
 * AEROOPS PWA SERVICE WORKER — v5.0
 * Lock Screen Push & Offline Caching
 * ═══════════════════════════════════════════════════════════ */
const CACHE_NAME = "aeroops-pwa-v5";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/apple-touch-icon.png",
  "/icon.svg",
];

// 1. Service Worker Installation
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

// 2. Service Worker Activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// 3. Web Push Event Handler (Lock Screen & Background Push)
self.addEventListener("push", (event) => {
  let data = {
    title: "AeroOps Crew Portal",
    body: "تحديث جديد في الجدول التشغيلي",
    url: "/?view=schedule",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "إشعار رحلة جديدة أو تحديث طاقم",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true, // Keeps notification on mobile lock screen until swiped/opened
    renotify: true,
    tag: data.tag || "aeroops-flight-alert",
    data: {
      url: data.url || "/?view=schedule",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "AeroOps Flight Ops", options)
  );
});

// 4. Client Message Event Handler (Trigger Lock Screen Notification directly)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_LOCKSCREEN_NOTIFICATION") {
    const { title, body, tag, url, category } = event.data;
    const options = {
      body: body || "تحديث جديد من بوابتك التشغيلية",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      renotify: true,
      tag: tag || `aeroops-${category || "alert"}-${Date.now()}`,
      data: {
        url: url || "/?view=schedule",
      },
    };
    event.waitUntil(
      self.registration.showNotification(
        title || "AeroOps Crew Portal",
        options
      )
    );
  }
});

// 5. Notification Click Event Handler (Focus app or open window)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// 6. Fetch Handler (Offline Support)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/node_modules/")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches
            .open(CACHE_NAME)
            .then((c) => c.put(event.request, clone))
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return Response.error();
        })
      )
  );
});
