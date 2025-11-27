import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app-id"
};

// Check if using demo/placeholder values
export const isFirebaseConfigured = () => {
  return !(
    firebaseConfig.apiKey === "demo-api-key" ||
    firebaseConfig.projectId === "demo-project" ||
    !import.meta.env.VITE_FIREBASE_API_KEY
  );
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.warn('Firebase initialization error:', error);
  // Create a dummy app for fallback
  app = initializeApp(firebaseConfig, 'fallback');
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to emulator in development mode
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  } catch (error) {
    console.warn('Functions emulator connection error:', error);
  }
  try {
    // Connect to Storage emulator if not already connected
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    // Ignore if already connected
    if (!(error as any).message?.includes('already been initialized')) {
      console.warn('Storage emulator connection error:', error);
    }
  }
}

// Validate Storage configuration
export const isStorageConfigured = () => {
  return isFirebaseConfigured() && firebaseConfig.storageBucket && firebaseConfig.storageBucket !== "demo-project.appspot.com";
};

export default app;
