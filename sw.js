'use strict';

// lets use ES6 because why not?
// this polyfill is useless -- the ServiceWorker will not work in Chrome 40 due to arrow functions
// self.importScripts('https://seoscribe.net/assets/js/serviceworker-cache-polyfill.js');

const CACHE_VERSION = 4;
const CURRENT_CACHES = { prefetch: 'editor-v' + CACHE_VERSION };

self.addEventListener('install', event => {
  const urlsToPrefetch = [
    'https://seoscribe.net/editor/',
    'https://seoscribe.net/assets/js/editor.js',
    'https://seoscribe.net/assets/js/editor-worker.js',
    'https://seoscribe.net/assets/js/event-listener-options.shim.js',
    'https://seoscribe.net/manifest.json'
  ];
  event.waitUntil(
    self.caches.open(CURRENT_CACHES.prefetch).then(cache => {
      return cache.addAll(urlsToPrefetch);
    })
  );
});

self.addEventListener('activate', event => {
  const expectedCacheNames = self.Object.keys(CURRENT_CACHES).map(key => {
    return CURRENT_CACHES[key];
  });  
  event.waitUntil(
    self.caches.keys().then(cacheNames => {
      return self.Promise.all(
        cacheNames.map(cacheName => {
          if (expectedCacheNames.indexOf(cacheName) === -1){
            return self.caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      self.fetch(event.request.url).catch(() => {
        return self.caches.match('/offline/');
      })
    );
  } else {
    event.respondWith(
      self.caches.match(event.request).then(response => {
        return response || self.fetch(event.request);
      })
    );
  }
});
