// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBtLFNwnAqBYFR7eFi-bKaT4Vq9Zu15a6I",
  authDomain: "kotaniapp-4f017.firebaseapp.com",
  projectId: "kotaniapp-4f017",
  storageBucket: "kotaniapp-4f017.appspot.com", // ← ".app" ではなく ".com"
  messagingSenderId: "623409374889",
  appId: "1:623409374889:web:ce7f3636fccb126323abb8"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Firestoreを取得
const db = getFirestore(app);

export { db };
