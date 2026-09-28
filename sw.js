self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ self.clients.claim(); });

self.addEventListener('message', e=>{
  if(e.data && e.data.type==='SET_BADGE'){
    if('setAppBadge' in self.navigator){
      if(e.data.count>0) self.navigator.setAppBadge(e.data.count).catch(()=>{});
      else if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
    }
  }
  if(e.data && e.data.type==='CLEAR_BADGE'){
    if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
  }
});

self.addEventListener('notificationclick', e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(list=>{
    for(let c of list) if(c.url.includes('Vibra')) return c.focus();
    return clients.openWindow('./index.html?mode=app');
  }));
});
