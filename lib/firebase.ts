import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDocFromServer, initializeFirestore } from "firebase/firestore";
import firebaseConfig from "@/firebase-applet-config.json";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut };

// Test connection on boot per Firebase guidelines
if (typeof window !== "undefined") {
  async function testConnection() {
    try {
      await getDocFromServer(doc(db, "test", "connection"));
    } catch (error) {
      if (error instanceof Error && (error.message.includes("the client is offline") || error.message.includes("unavailable"))) {
        console.warn("Firebase is operating in offline mode or connection is unavailable.");
      }
    }
  }
  void testConnection();
}
