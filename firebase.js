import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { 
    getAuth,
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOHTdr-oFbWLs6nPPv-35hxuxBM4B9fxg",
  authDomain: "cadence-ai-37cdf.firebaseapp.com",
  projectId: "cadence-ai-37cdf",
  storageBucket: "cadence-ai-37cdf.firebasestorage.app",
  messagingSenderId: "1098338394667",
  appId: "1:1098338394667:web:23993db4a595de4484406e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
