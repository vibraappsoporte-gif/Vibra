// Cloud Function Vibra - Notificación con app cerrada como APK real
// Instalar: firebase init functions, pegar este código en functions/index.js, firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onNewVibraMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;
    
    // Evitar notificar mensajes propios o sistema
    if (!message) return null;
    const senderId = message.senderId || message.from || message.uid;
    const text = message.text || message.message || 'Te escribió';

    try {
      // Obtener chat para saber participantes
      const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
      if (!chatDoc.exists) return null;
      const chat = chatDoc.data();
      
      // Participantes: array de uids o objeto
      let participants = chat.participants || chat.members || chat.users || [];
      if (!Array.isArray(participants)) participants = Object.keys(participants);
      
      // Receptores = todos menos el que envió
      const receivers = participants.filter(p => p !== senderId);
      
      // Obtener nombre sender
      let senderName = 'Alguien';
      try {
        const senderDoc = await admin.firestore().collection('users').doc(senderId).get();
        if (senderDoc.exists) {
          senderName = senderDoc.data().name || senderDoc.data().displayName || senderName;
        }
      } catch(e){}

      // Para cada receptor, buscar su token FCM en vibra_tokens
      for (const receiverId of receivers) {
        try {
          // Buscar token por uid (si guardas uid) o buscar todos y filtrar
          // Opción 1: si guardas por uid
          const tokenDoc = await admin.firestore().collection('vibra_tokens').doc(receiverId).get();
          let tokens = [];
          if (tokenDoc.exists && tokenDoc.data().token) {
            tokens.push(tokenDoc.data().token);
          } else {
            // Opción 2: buscar tokens donde userId == receiverId (si tu app usa anon)
            // Aquí mandamos a todos los tokens recientes (para prueba)
            const allTokens = await admin.firestore().collection('vibra_tokens').limit(100).get();
            allTokens.forEach(d => {
              if (d.data().token) tokens.push(d.data().token);
            });
          }

          if (tokens.length === 0) continue;

          // Contar no leídos para badge
          const unreadSnap = await admin.firestore().collection('chats').doc(chatId).collection('messages')
            .where('read', '==', false).get().catch(()=>({size:1}));
          const badgeCount = unreadSnap.size || 1;

          const payload = {
            notification: {
              title: `Vibra 💬 ${senderName}`,
              body: text.length > 80 ? text.substring(0,80)+'...' : text,
            },
            data: {
              chatId: chatId,
              sender: senderName,
              count: String(badgeCount),
              type: 'new_message'
            },
            tokens: tokens
          };

          // Enviar multicast
          const response = await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: payload.notification,
            data: payload.data,
            android: {
              notification: {
                icon: 'icon-192.png',
                color: '#7c3aed',
                channelId: 'vibra_messages',
                notificationCount: badgeCount
              }
            },
            apns: {
              payload: {
                aps: {
                  badge: badgeCount,
                  sound: 'default'
                }
              }
            },
            webpush: {
              notification: {
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [80,40,80],
                requireInteraction: false,
                tag: 'vibra-msg'
              },
              fcmOptions: {
                link: `/index.html?mode=app&chat=${chatId}`
              }
            }
          });

          console.log(`Push enviado a ${receiverId}:`, response.successCount, 'ok,', response.failureCount, 'fail');
        } catch(err) {
          console.error('Error enviando a', receiverId, err);
        }
      }
    } catch(e) {
      console.error('Error onNewVibraMessage', e);
    }
    return null;
  });

// Función para limpiar tokens inválidos
exports.cleanInvalidTokens = functions.pubsub.schedule('every 24 hours').onRun(async()=>{
  // Opcional: limpiar tokens viejos
  return null;
});
