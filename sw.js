self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ self.clients.claim(); if(self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(()=>{}); });
self.addEventListener('message', e=>{
  if(e.data && e.data.type==='SET_BADGE' && 'setAppBadge' in self.navigator){
    if(e.data.count>0) self.navigator.setAppBadge(e.data.count).catch(()=>{}); else self.navigator.clearAppBadge().catch(()=>{});
  }
  if(e.data && e.data.type==='CLEAR_BADGE' && 'clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
});
self.addEventListener('fetch', e=>{ e.respondWith(fetch(e.request).catch(()=> new Response('',{status:200}))); });
