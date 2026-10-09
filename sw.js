/* Offline cache for the walkthrough. Textures, models and the versioned three.js library are served from the cache at once and
   refreshed in the background; pages and scripts are fetched fresh when online and come from the cache only when offline. */
const CACHE='walk-v1';
const ASSET=/\/textures\/|\.(?:glb|hdr|ktx2|jpg|png|wasm)$/;

self.addEventListener('install',function(){ self.skipWaiting(); });
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
function save(req,res){ if(res&&res.ok){ const c=res.clone(); caches.open(CACHE).then(function(cache){ cache.put(req,c); }); } return res; }
self.addEventListener('fetch',function(e){
  const req=e.request; if(req.method!=='GET') return;
  const u=new URL(req.url), cdn=u.hostname==='cdn.jsdelivr.net';
  if(u.origin!==self.location.origin&&!cdn) return;
  if(cdn||ASSET.test(u.pathname)){                // cache first, refresh in the background
    e.respondWith(caches.match(req).then(function(hit){
      const net=fetch(req).then(function(res){ return save(req,res); });
      if(hit){ e.waitUntil(net.catch(function(){})); return hit; }
      return net;
    }));
    return;
  }
  e.respondWith(fetch(req).then(function(res){ return save(req,res); }).catch(function(){   // network first
    return caches.match(req,{ignoreSearch:true}).then(function(hit){ return hit||Response.error(); });
  }));
});
