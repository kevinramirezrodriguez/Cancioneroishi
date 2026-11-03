// Guarda una copia de la app para que abra sin internet.
// Con buena conexión siempre pide primero la versión más nueva (así llegan tus canciones nuevas).
// Si la red está lenta o "colgada" (pasa con algunos datos móviles), a los pocos segundos abre la copia guardada
// y la versión nueva se sigue descargando en segundo plano para la próxima vez.
const CACHE = 'cancionero-v3';
const ESPERA_RED = 4000;   // milisegundos que se espera a la red antes de usar la copia guardada
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // Se guardan los archivos de uno en uno: si alguno falla por mala red, los demás se guardan igual
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ARCHIVOS.map(a => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const red = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) {
      const copia = res.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
    }
    return res;
  });
  const guardada = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'));

  e.respondWith(
    new Promise(resolver => {
      let listo = false;
      const usar = r => { if (!listo && r) { listo = true; resolver(r); } };
      const t = setTimeout(() => { guardada().then(usar); }, ESPERA_RED);   // red lenta: se usa la copia guardada
      red.then(r => { clearTimeout(t); usar(r); })
         .catch(() => { clearTimeout(t); guardada().then(r => { if (r) usar(r); else if (!listo) { listo = true; resolver(Response.error()); } }); });
    })
  );
  e.waitUntil(red.catch(() => {}));   // la descarga sigue en segundo plano aunque se haya usado la copia
});
