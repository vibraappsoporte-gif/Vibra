importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

var firebaseConfig = {apiKey:"AIzaSyA3f6NfbDGpr8JsSybpn5XdmzGCmJPQTqY",authDomain:"apk-simple.firebaseapp.com",projectId:"apk-simple",storageBucket:"apk-simple.firebasestorage.app",messagingSenderId:"184380088864",appId:"1:184380088864:web:3f0e17ee08fe0cdbb61245"};
try{ firebase.initializeApp(firebaseConfig); }catch(e){}

let messaging;
try{ messaging = firebase.messaging(); }catch(e){}

self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ 
  e.waitUntil(self.clients.claim()); 
});

let lastBadgeCount = 0;
let currentChatId = null;

self.addEventListener('message', e=>{
  if(!e.data) return;
  if(e.data.type==='SET_BADGE' || e.data.type==='VIBRA_BADGE'){
    try{
      lastBadgeCount = parseInt(e.data.count)||0;
      if('setAppBadge' in self.navigator){
        if(lastBadgeCount>0) self.navigator.setAppBadge(lastBadgeCount).catch(()=>{});
        else if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{});
      }
    }catch(err){}
  }
  if(e.data.type==='CLEAR_BADGE'){
    try{ lastBadgeCount=0; if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{}); }catch(e){}
  }
  if(e.data.type==='VIBRA_NEW_MESSAGE'){
    const count = parseInt(e.data.count)||1;
    lastBadgeCount = count;
    currentChatId = e.data.chatId || null;
    showVibraNotification(count, e.data.sender||'Alguien', e.data.text||'Te escribió', e.data.chatId);
    try{ if('setAppBadge' in self.navigator) self.navigator.setAppBadge(count).catch(()=>{}); }catch(e){}
  }
  if(e.data.type==='SET_CURRENT_CHAT'){
    currentChatId = e.data.chatId;
  }
});

function showVibraNotification(count, sender, text, chatId){
  const title = sender ? `${sender} 💬` : 'Vibra 💬';
  const body = text ? (text.length>60? text.substring(0,60)+'...' : text) : (count===1 ? `${sender} te escribió` : `${count} mensajes nuevos en Vibra`);
  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: chatId ? `vibra-${chatId}` : 'vibra-msg',
    renotify: true,
    vibrate: [80,40,80,40,120],
    requireInteraction: false,
    silent: false,
    data: {url: `./index.html?mode=app${chatId ? '&chat='+chatId : ''}`, chatId: chatId||''},
    actions: [{action:'open', title:'Abrir'}, {action:'close', title:'Cerrar'}]
  };
  self.registration.showNotification(title, options);
}

// Push real desde FCM (cuando app está cerrada - este es el que hace sonar)
if(messaging){
  messaging.onBackgroundMessage(payload=>{
    console.log('FCM background - APP CERRADA', payload);
    const count = parseInt(payload.data?.count||payload.data?.badge||'1');
    lastBadgeCount = count;
    const sender = payload.data?.sender || payload.notification?.title || 'Nuevo mensaje';
    const text = payload.notification?.body || payload.data?.text || '';
    const chatId = payload.data?.chatId || '';
    // Guardar badge
    try{ if('setAppBadge' in self.navigator && count>0) self.navigator.setAppBadge(count); }catch(e){}
    // Mostrar notificación con SONIDO aunque esté cerrada
    showVibraNotification(count, sender, text, chatId);
  });
}

self.addEventListener('push', e=>{
  console.log('Push recibido - APP CERRADA', e);
  let data = {};
  let title = 'Vibra 💬';
  let body = 'Tienes mensajes nuevos';
  let count = 1;
  let chatId = '';
  let sender = 'Alguien';
  try{
    if(e.data){
      try{ data = e.data.json(); }catch{ data = {body: e.data.text()}; }
      title = data.notification?.title || data.data?.sender || data.title || title;
      body = data.notification?.body || data.data?.text || data.body || body;
      count = data.data?.count || data.count || count;
      chatId = data.data?.chatId || '';
      sender = data.data?.sender || sender;
    }
  }catch(err){}

  lastBadgeCount = parseInt(count)||1;
  e.waitUntil(
    (async()=>{
      try{ if('setAppBadge' in self.navigator) await self.navigator.setAppBadge(count); }catch(err){}
      return self.registration.showNotification(title, {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: chatId ? `vibra-${chatId}` : 'vibra-msg',
        vibrate: [80,40,80,40,120],
        renotify: true,
        silent: false,
        data: {url: `./index.html?mode=app${chatId?'&chat='+chatId:''}`, chatId: chatId}
      });
    })()
  );
});

self.addEventListener('notificationclick', e=>{
  e.notification.close();
  const chatId = e.notification.data?.chatId || '';
  const urlToOpen = e.notification.data?.url || './index.html?mode=app';
  // Si es 1 solo mensaje, limpiar badge
  if(lastBadgeCount<=1){
    try{ if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(()=>{}); lastBadgeCount=0; }catch(err){}
  }
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
    for(let c of list){
      if(c.url.includes('mode=app') || c.url.includes('Vibra') || c.url.includes('github.io')){
        c.postMessage({type:'OPEN_CHAT', chatId: chatId});
        return c.focus();
      }
    }
    return clients.openWindow(urlToOpen);
  }));
});

self.addEventListener('notificationclose', e=>{
  // No hacer nada, mantener badge
});
