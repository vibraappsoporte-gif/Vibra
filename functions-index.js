// Cloud Function Vibra - Notificacion con app cerrada + globito + sonido
// Deploy: firebase deploy --only functions
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onNewVibraMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;
    if (!message) return null;
    const senderId = message.senderId || message.from || message.uid || message.authorId;
    const text = message.text || message.message || message.content || 'Te escribió';
    const type = message.type || 'text';
    const isPhoto = type.includes('photo') || text.includes('📸');

    try {
      const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
      if (!chatDoc.exists) return null;
      const chat = chatDoc.data();
      let participants = chat.participants || chat.members || chat.users || chat.participantIds || [];
      if (!Array.isArray(participants)) participants = Object.keys(participants);
      const receivers = participants.filter(p => p !== senderId);
      if (receivers.length===0) {
        // fallback: buscar en vibra_tokens todos menos sender
        const all = await admin.firestore().collection('vibra_tokens').limit(50).get();
        all.forEach(d=>{
          if(d.id!==senderId && d.data().token) receivers.push(d.id);
        });
      }

      let senderName = 'Alguien';
      try {
        const senderDoc = await admin.firestore().collection('users').doc(senderId).get();
        if (senderDoc.exists) senderName = senderDoc.data().name || senderDoc.data().displayName || senderName;
      }catch(e){}

      for (const receiverId of receivers) {
        try {
          let tokens = [];
          // Buscar token del receptor
          const tokenDoc = await admin.firestore().collection('vibra_tokens').doc(receiverId).get();
          if (tokenDoc.exists && tokenDoc.data().token) {
            tokens.push(tokenDoc.data().token);
          }
          // Buscar también en users/{uid} fcmToken
          try{
            const userDoc = await admin.firestore().collection('users').doc(receiverId).get();
            if(userDoc.exists && userDoc.data().fcmToken) tokens.push(userDoc.data().fcmToken);
          }catch(e){}

          if (tokens.length===0) continue;
          tokens = [...new Set(tokens)]; // unique

          // Badge: contar mensajes no leídos de todos los chats de este usuario (aprox)
          let badgeCount = 1;
          try{
            const chatsSnap = await admin.firestore().collection('chats').where('participants','array-contains', receiverId).get();
            badgeCount = chatsSnap.size || 1;
          }catch(e){ badgeCount = 1; }

          const displayText = isPhoto ? '📸 Foto' : (text.length>80? text.substring(0,80)+'...' : text);

          const payload = {
            tokens: tokens,
            notification: {
              title: `${senderName} 💬`,
              body: displayText,
            },
            data: {
              chatId: chatId,
              sender: senderName,
              text: displayText,
              count: String(badgeCount),
              type: 'new_message',
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            android: {
              priority: 'high',
              notification: {
                icon: 'icon-192.png',
                color: '#7c3aed',
                channelId: 'vibra_messages_high',
                notificationCount: badgeCount,
                visibility: 'public',
                priority: 'high',
                sound: 'default',
                defaultSound: true,
                defaultVibrateTimings: true
              }
            },
            apns: {
              headers: {'apns-priority':'10'},
              payload: {
                aps: {
                  badge: badgeCount,
                  sound: 'default',
                  alert: {title: `${senderName} 💬`, body: displayText}
                }
              }
            },
            webpush: {
              headers: {Urgency: 'high'},
              notification: {
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [80,40,80,40,120],
                requireInteraction: false,
                silent: false,
                tag: `vibra-${chatId}`,
                renotify: true,
                actions: [{action:'open', title:'Abrir'}]
              },
              fcmOptions: {link: `/index.html?mode=app&chat=${chatId}`}
            }
          };

          const response = await admin.messaging().sendEachForMulticast(payload);
          console.log(`✅ Push Vibra a ${receiverId} (${senderName}): ${response.successCount} ok / ${response.failureCount} fail`);
          
          // Limpiar tokens inválidos
          if(response.failureCount>0){
            response.responses.forEach(async (resp, idx)=>{
              if(!resp.success && resp.error?.code==='messaging/invalid-registration-token'){
                console.log('Token invalido', tokens[idx]?.substring(0,10));
              }
            });
          }
        }catch(err){ console.error('Error push a', receiverId, err); }
      }
    }catch(e){ console.error('Error onNewVibraMessage', e); }
    return null;
  });
