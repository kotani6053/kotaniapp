import { initializeApp } from "firebase/app";
// ★ getFirestore を追加
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBtLFNwnAqBYFR7eFi-bKaT4Vq9Zu15a6I",
  authDomain: "kotaniapp-4f017.firebaseapp.com",
  projectId: "kotaniapp-4f017",
  storageBucket: "kotaniapp-4f017.firebasestorage.app",
  messagingSenderId: "623409374889",
  appId: "1:623409374889:web:ce7f3636fccb126323abb8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ★ Firestoreを初期化してエクスポートする
export const db = getFirestore(app);
