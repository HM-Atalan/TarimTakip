const CACHE='tarimtakip-v2';
const APP_SHELL=['./','./index.html','./style.css','./icon.svg','./manifest.webmanifest','./firebase-config.js','./cropData.js','./constants.js','./globals.js','./utils.js','./weather.js','./soilModel.js','./satellite.js','./phenology.js','./events.js','./photos.js','./ai.js','./fieldCrud.js','./ui.js','./auth.js','./map.js','./reports.js','./main.js'];

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin){ event.respondWith(fetch(event.request).catch(()=>caches.match(event.request))); return; }
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){ const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); }
    return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
});
