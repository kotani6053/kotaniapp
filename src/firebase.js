// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBc4YbC8i4e0vTGAnNB_7KPAw0tIPBXw-k",
  authDomain: "kotani-y.firebaseapp.com",
  projectId: "kotani-y",
  storageBucket: "kotani-y.firebasestorage.app",
  messagingSenderId: "660389982374",
  appId: "1:660389982374:web:3797ee189f84c998288467"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
