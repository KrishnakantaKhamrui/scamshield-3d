"use strict";

const CACHE_NAME = "scamshield-shell-v1";
const SHELL_ROUTES = new Set(["/", "/analyze"]);
const STATIC_SHELL = new Set([
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(Array.from(STATIC_SHELL)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith("scamshield-shell-") && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.search ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (STATIC_SHELL.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (!SHELL_ROUTES.has(url.pathname) || request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch {
        return (await cache.match(url.pathname)) ?? Response.error();
      }
    })(),
  );
});
