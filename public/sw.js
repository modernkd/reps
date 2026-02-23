const CACHE_VERSION = "v1";
const EXERCISE_ASSET_CACHE = `workout-tracker-exercise-assets-${CACHE_VERSION}`;
const EXERCISE_DB_CACHE = `workout-tracker-exercise-db-${CACHE_VERSION}`;
const ACTIVE_CACHES = new Set([EXERCISE_ASSET_CACHE, EXERCISE_DB_CACHE]);

function shouldCacheExerciseImage(url) {
  const isLocalExerciseImage =
    url.origin === self.location.origin &&
    url.pathname.startsWith("/images/exercises/");
  const isRemoteExerciseImage =
    url.origin === "https://raw.githubusercontent.com" &&
    url.pathname.includes("/yuhonas/free-exercise-db/main/exercises/");

  return isLocalExerciseImage || isRemoteExerciseImage;
}

function isExerciseDbPayload(url) {
  return (
    url.origin === "https://raw.githubusercontent.com" &&
    url.pathname.endsWith("/yuhonas/free-exercise-db/main/dist/exercises.json")
  );
}

function isCacheableResponse(response) {
  return Boolean(response && (response.ok || response.type === "opaque"));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    await cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    return new Response(null, {
      status: 504,
      statusText: "Offline and not cached",
    });
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith("workout-tracker-") &&
              !ACTIVE_CACHES.has(cacheName),
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (isExerciseDbPayload(url)) {
    event.respondWith(networkFirst(request, EXERCISE_DB_CACHE));
    return;
  }

  if (shouldCacheExerciseImage(url)) {
    event.respondWith(cacheFirst(request, EXERCISE_ASSET_CACHE));
  }
});
