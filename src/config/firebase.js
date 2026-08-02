import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = window.GOLDENCARE_FIREBASE_CONFIG || {};

export const firebaseConfigured = Boolean(
  config.apiKey &&
  config.projectId &&
  config.appId &&
  !String(config.apiKey).startsWith('PASTE_') &&
  !String(config.projectId).startsWith('PASTE_')
);

let app = null;
let auth = null;
let db = null;

if (firebaseConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
