importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

var firebaseConfig = {apiKey:"AIzaSyA3f6NfbDGpr8JsSybpn5XdmzGCmJPQTqY",authDomain:"apk-simple.firebaseapp.com",projectId:"apk-simple",storageBucket:"apk-simple.firebasestorage.app",messagingSenderId:"184380088864",appId:"1:184380088864:web:3f0e17ee08fe0cdbb61245"};
try{ firebase.initializeApp(firebaseConfig); }catch(e){}

let messaging;
try{ messaging = firebase.messaging(); }catch(e){}

self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ self.clients.claim(); });

let lastBadgeCount = 0;
self.addEventListener('message', e=>{
  if(e.data && (e.data.type==='SET_BADGE' || e.data.type==='VIBRA_BADGE')){
    try{
      lastBadgeCount = parseInt(e.data.count)||0;
      if('setAppBadge' in self.navigator){
        if(e.data.count>0) self.navigator.setAppBadge(e.data.count).catch(()=>{});
        else if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
      }
    }catch(err){}
  }
  if(e.data && e.data.type==='CLEAR_BADGE'){
    try{ lastBadgeCount=0; if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{}); }catch(e){}
  }
  if(e.data && e.data.type==='VIBRA_NEW_MESSAGE'){
    const count = e.data.count||1;
    lastBadgeCount = count;
    showVibraNotification(count, e.data.sender||'Alguien');
    try{ if('setAppBadge' in self.navigator) self.navigator.setAppBadge(count).catch(()=>{}); }catch(e){}
  }
});

function showVibraNotification(count, sender){
  const title = 'Vibra 💬';
  const body = count===1 ? `${sender} te escribió` : `${count} mensajes nuevos en Vibra`;
  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'vibra-msg',
    renotify: true,
    vibrate: [80,40,80,40,120],
    requireInteraction: false,
    data: {url: './index.html?mode=app'},
    silent: false
  };
  self.registration.showNotification(title, options);
}

// Push real desde FCM (cuando tengas Cloud Function)
if(messaging){
  messaging.onBackgroundMessage(payload=>{
    console.log('FCM background', payload);
    const count = parseInt(payload.data?.count||'1');
    lastBadgeCount = count;
    const sender = payload.data?.sender || payload.notification?.title || 'Nuevo mensaje';
    showVibraNotification(count, sender);
    try{ if('setAppBadge' in self.navigator && count>0) self.navigator.setAppBadge(count); }catch(e){}
  });
}

self.addEventListener('push', e=>{
  console.log('Push recibido', e);
  let data = {};
  try{ data = e.data ? e.data.json() : {}; }catch(err){ data = {title:'Vibra 💬', body: e.data ? e.data.text() : 'Mensaje nuevo'}; }
  const title = data.title || data.notification?.title || 'Vibra 💬';
  const body = data.body || data.notification?.body || 'Tienes mensajes nuevos';
  const count = data.count || data.data?.count || 1;
  lastBadgeCount = parseInt(count)||1;
  e.waitUntil(
    (async()=>{
      try{ if('setAppBadge' in self.navigator) await self.navigator.setAppBadge(count); }catch(err){}
      return self.registration.showNotification(title, {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'vibra-msg',
        vibrate: [80,40,80,40,120],
        renotify: true,
        data: {url: './index.html?mode=app'}
      });
    })()
  );
});

self.addEventListener('notificationclick', e=>{
  e.notification.close();
  // NO borrar badge automáticamente - solo al entrar al chat se borra
  // Si el badge era 1 y abriste, ahora sí limpiar
  if(lastBadgeCount<=1){
    try{ if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{}); lastBadgeCount=0; }catch(err){}
  }
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
    for(let c of list){
      if(c.url.includes('mode=app') || c.url.includes('Vibra') || c.url.includes('github.io')){
        return c.focus();
      }
    }
    return clients.openWindow('./index.html?mode=app');
  }));
});