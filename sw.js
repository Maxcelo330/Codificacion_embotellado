/* Service Worker — Codificado · Calidad Embotellado Embol
   Cache-first para los archivos propios (funciona sin internet).
   IMPORTANTE: sube el número de VERSION cada vez que modifiques la app. */

const VERSION = 'codif-v3';

const CORE = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png',
  './icons/favicon-64.png',
  './icons/logo-header.png'
];

/* Librerías externas para exportar. Si no se pueden guardar, la app igual
   funciona: usa formatos de respaldo (CSV e impresión). */
const CDN = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@700;800&display=swap'
];

/* ── Guarda los archivos del núcleo; se puede llamar las veces que haga falta ── */
async function guardarNucleo() {
  const c = await caches.open(VERSION);
  await Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: 'reload' }))));
  await Promise.allSettled(CDN.map(u => c.add(new Request(u, { mode: 'cors' }))));
}

/**
 * Página que se muestra cuando no hay internet y tampoco quedó copia guardada.
 * Va escrita aquí dentro a propósito: si dependiera de un archivo, en este
 * momento tampoco estaría disponible y el analista vería una pantalla en blanco.
 */
function paginaSinConexion() {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Sin conexión · Codificado</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#F6F7F9;color:#1A1D23;
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  display:flex;align-items:center;justify-content:center;min-height:100vh;padding:22px}
.c{background:#fff;border-radius:20px;padding:28px 24px;max-width:440px;width:100%;
  box-shadow:0 1px 2px rgba(20,24,34,.04),0 8px 30px rgba(20,24,34,.10);text-align:center}
.i{width:64px;height:64px;margin:0 auto 18px;border-radius:18px;background:#FFF3F3;
  display:grid;place-items:center}
.i svg{width:34px;height:34px;fill:#F40009}
h1{font-size:20px;font-weight:800;margin:0 0 8px;letter-spacing:-.4px}
p{font-size:14.5px;line-height:1.55;color:#6A7382;font-weight:500;margin:0 0 16px}
.n{background:#F6F7F9;border-radius:13px;padding:14px 16px;text-align:left;
  font-size:13px;color:#6A7382;font-weight:600;line-height:1.55;margin-bottom:18px}
.n b{color:#1A1D23}
button{width:100%;border:0;background:#F40009;color:#fff;border-radius:13px;padding:15px;
  font-size:15.5px;font-weight:800;font-family:inherit;cursor:pointer;
  box-shadow:0 6px 18px rgba(244,0,9,.3)}
button:active{transform:scale(.98)}
small{display:block;margin-top:16px;font-size:11px;color:#98A1AE;font-weight:700;
  text-transform:uppercase;letter-spacing:1px}
</style></head><body>
<div class="c">
  <div class="i"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
  <h1>No se pudo abrir la app</h1>
  <p>El celular no tiene internet y no quedó una copia guardada de la aplicación.</p>
  <div class="n">
    <b>Qué hacer:</b><br>
    Conéctate a wifi o datos móviles una sola vez y vuelve a abrir la app.
    Desde ahí queda guardada en el celular y ya funciona sin internet.<br><br>
    <b>Por qué pasó:</b><br>
    Normalmente esto ocurre después de borrar los datos o el caché del navegador,
    que también borra la copia de la app.
  </div>
  <button onclick="location.reload()">Reintentar</button>
  <small>Calidad Embotellado · Embol S.A.</small>
</div></body></html>`;
  return new Response(html, {
    status: 503,
    statusText: 'Sin conexión',
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

self.addEventListener('install', e => {
  e.waitUntil((async () => { await guardarNucleo(); self.skipWaiting(); })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* La app puede pedir que se vuelva a guardar el núcleo (por ejemplo si detecta
   que faltan archivos después de una limpieza del navegador). */
self.addEventListener('message', e => {
  if (e.data === 'reguardar') e.waitUntil(guardarNucleo());
});

/* Al tocar la notificación se abre la app */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const cls = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cls) {
      if ('focus' in c) { c.navigate('./index.html').catch(() => {}); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow('./index.html');
  })());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (!/^https?:$/.test(new URL(request.url).protocol)) return;

  e.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      // Se refresca en segundo plano para la próxima vez
      fetch(request).then(res => {
        if (res && res.ok) caches.open(VERSION).then(c => c.put(request, res.clone()));
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(request);
      if (res && res.ok) {
        const c = await caches.open(VERSION);
        c.put(request, res.clone());
      }
      return res;
    } catch {
      if (request.mode === 'navigate') {
        // Si se perdió la copia de index.html, se intenta la raíz antes de rendirse
        const fb = await caches.match('./index.html') || await caches.match('./');
        if (fb) return fb;
        return paginaSinConexion();
      }
      return new Response('', { status: 503, statusText: 'Sin conexión' });
    }
  })());
});
