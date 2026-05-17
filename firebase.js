// // firebase.js
// const admin = require('firebase-admin');

// // Load your service account key JSON file
// const serviceAccount = require('./googleServices.json'); 
// // Make sure this file is downloaded from Firebase Console → Project Settings → Service Accounts

// // Initialize the Firebase Admin SDK
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://<your-project-id>.firebaseio.com" // replace with your Firebase project URL
// });

// // Export the initialized admin instance
// module.exports = admin;


const admin = require('firebase-admin');

try {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DB_URL;

  if (!rawServiceAccount) {
    console.error("FATAL: process.env.FIREBASE_SERVICE_ACCOUNT is missing.");
    process.exit(1);
  }

  // Parse the stringified JSON string back into a functional config object
  const serviceAccount = JSON.parse(rawServiceAccount);

  // Fix internal string escaping bugs for specific hosting environments (like Vercel/Render)
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL || `https://${serviceAccount.project_id}.firebaseio.com`
  });

  console.log("Firebase Admin SDK successfully initialized via environment context.");

} catch (error) {
  console.error("Critical error configuring Firebase Admin SDK credentials:", error.message);
  process.exit(1);
}

module.exports = admin;