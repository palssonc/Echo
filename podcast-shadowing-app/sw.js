const CACHE='echo-static-v5';
const FILES=['./','./index.html','./styles.css','./downloads.js','./capture.js','./capture-worklet.js','./audio-events.js','./app.js','./manifest.webmanifest','./icon.svg'];
const STATIC_PATHS=new Set(FILES.map(file=>new URL(file,self.registration.scope).pathname));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(response=>{
    if(response.ok&&STATIC_PATHS.has(url.pathname)){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(e.request,copy));
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(e.request);
    if(cached)return cached;
    if(e.request.mode==='navigate')return caches.match('./index.html');
    return Response.error();
  }));
});
