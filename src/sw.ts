import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

const CACHE_NAME = 'minute-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

(self as any).addEventListener('install', (event: any) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

(self as any).addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
