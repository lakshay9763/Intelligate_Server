
const admin = require('../firebase.js');


exports.sendPushNotificationToResidents = async (residents, payload) => {

    console.log(residents.length, 'fggg')
    
    residents.forEach(async (item) => {
        const token = item.fcmToken
        console.log(token)
        try {
            await admin.messaging().send({
                token: token,
                notification: {
                    title: "Gate Alert 🏠",
                    body: `${payload.name} is at the gate.`,
                },
                android: {
                    priority: "high", // Ensures immediate delivery
                    notification: {
                        channelId: "resident_alerts", // Matches App.js
                        sound: "resident_alert",      // Matches res/raw/resident_alert.mp3
                        priority: "max",              // Forces heads-up (popup) display
                    },
                },
                data: {
                    type: "Visitor",
                    requestId: String(payload.requestId),
                    screen: 'Notif',
                    visitorName: String(payload.name),
                    photoUrl: String(payload.photoUrl)
                }
            });
            console.log("Fcm sended!!!")
        } catch (fcmError) {
            console.error("FCM Error:-----------------", fcmError.message);
            // We don't return error here because the DB record is already saved
        }

    })

}

