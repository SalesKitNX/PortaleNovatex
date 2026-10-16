/* Novatex Calcolatore Agenti — service worker (uso offline)
   Pagina: prima la rete (così credenziali e prezzi aggiornati arrivano subito),
   se la rete manca o è troppo lenta si usa l'ultima copia salvata. */
const CACHE = 'nvx-agenti-v6';
const TIMEOUT = 4000;

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('nvx-agenti-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function fromNetwork(req) {
  return fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url.split('#')[0].split('?')[0], copy)); }
    return res;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* archivio, loghi, YouTube: sempre in rete */
  if (req.cache === 'no-store') return;              /* "Esporta file" rilegge il sorgente dal server */
  const key = req.url.split('#')[0].split('?')[0];
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match(key).then(r => { if (!done && r) { done = true; resolve(r); } return r; });
      const timer = setTimeout(fallback, TIMEOUT);
      fromNetwork(req).then(res => { clearTimeout(timer); if (!done) { done = true; resolve(res); } })
        .catch(() => { clearTimeout(timer); fallback().then(r => { if (!done) { done = true; resolve(r || new Response('Offline: apri l’app almeno una volta con la rete.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })); } }); });
    }));
    return;
  }
  /* manifest, icone, sw: copia salvata, aggiornata in background */
  e.respondWith(caches.match(key).then(hit => { const net = fromNetwork(req).catch(() => hit); return hit || net; }));
});

/* tocco su un avviso di sistema: riporta in primo piano l'app (o la apre) sulla schermata Notifiche */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow('./Novatex_Agenti.html') : null;
  }));
});
/* predisposizione per Firebase Cloud Messaging (avvisi con app chiusa): vedi GUIDA_PASSAGGIO.md */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  const n = d.notification || d;
  e.waitUntil(self.registration.showNotification(n.title || 'Novatex', { body: n.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: n.tag || 'nvx' }));
});
