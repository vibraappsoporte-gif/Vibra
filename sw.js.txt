
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { 
  self.clients.claim();
  // Quitar badge al activar
  if(self.navigator && self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(()=>{});
});

self.addEventListener('message', event => {
  if(event.data && event.data.type==='SET_BADGE'){
    const count = event.data.count||0;
    if('setAppBadge' in self.navigator){
      if(count>0) self.navigator.setAppBadge(count).catch(()=>{});
      else self.navigator.clearAppBadge().catch(()=>{});
    }
  }
  if(event.data && event.data.type==='CLEAR_BADGE'){
    if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
  }
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title||'Vibra 💬', {
      body: data.body||'Nuevo mensaje en Vibra',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [120,40,120],
      tag: 'vibra-push',
      renotify: true
    }).then(()=>{
      if('setAppBadge' in self.navigator) return self.navigator.setAppBadge(1).catch(()=>{});
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
      for(let c of list){ if(c.url.includes('install.html')){ return c.focus(); } }
      return clients.openWindow('./install.html?mode=app');
    }).then(()=>{
      if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
    })
  );
});

// No cachear todo para evitar aviso de Chrome, solo fetch normal
self.addEventListener('fetch', e => { 
  if(e.request.url.includes('manifest.json') || e.request.url.includes('icon-')){
    e.respondWith(fetch(e.request));
  } else {
    e.respondWith(fetch(e.request).catch(()=> caches.match(e.request).then(r=>r||new Response('Offline'))));
  }
});
