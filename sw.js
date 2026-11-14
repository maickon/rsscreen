/* rsscreen — service worker
   - Painel instalável (PWA) e funcionando offline
   - Telas continuam rodando se a internet do ponto cair */
const VERSION = 'rsscreen-v10';
const SHELL = [
  './',
  './index.html',
  './painel/',
  './tela/',
  './config/clientes.js',
  './assets/js/core.js',
  './assets/js/icons.js',
  './assets/js/tela.js',
  './assets/js/playlist.js',
  './assets/js/painel.js',
  './assets/js/landing.js',
  './assets/css/brand.css',
  './assets/css/painel.css',
  './assets/css/landing.css',
  './assets/css/tela.css',
  './assets/img/icon.svg',
  './assets/img/icon-192.png',
  './modules/registry.json',
  './modules/pacotes.json',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(SHELL.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fotos e APIs externas: direto da rede

  const p = url.pathname;
  // sinais de uso, estatísticas e fotos das notícias: sempre direto da rede, sem guardar
  if (p.indexOf('/api/hit') >= 0 || p.indexOf('/api/stats') >= 0 || (p.indexOf('/api/rss') >= 0 && url.searchParams.get('og'))) return;
  // HTML, configuração, manifestos, módulos e feeds: sempre tenta a versão mais nova
  if (req.mode === 'navigate' || p.indexOf('/config/') >= 0 || p.indexOf('/modules/') >= 0 ||
      p.indexOf('/api/') >= 0 || p.endsWith('.webmanifest')) {
    event.respondWith(networkFirst(req));
    return;
  }
  // CSS, JS e imagens do sistema: rápido do cache, atualiza em segundo plano
  event.respondWith(staleWhileRevalidate(req));
});
