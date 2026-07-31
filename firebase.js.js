// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAuRMAJX7RMt5D35X0_oC_4rMTuQ6XG43A",
  authDomain: "jurnal-guru-digital-3bb86.firebaseapp.com",
  projectId: "jurnal-guru-digital-3bb86",
  storageBucket: "jurnal-guru-digital-3bb86.firebasestorage.app",
  messagingSenderId: "795067564900",
  appId: "1:795067564900:web:5e6600ad63c5923b78b071"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };