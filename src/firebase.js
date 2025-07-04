import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 修正済みの Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyBc4YbC8i4e0vTGAnNB_7KPAw0tIPBXw-k",
  authDomain: "kotani-y.firebaseapp.com",
  projectId: "kotani-y",
  storageBucket: "kotani-y.appspot.com", // ← 修正！
  messagingSenderId: "660389982374",
  appId: "1:660389982374:web:3797ee189f84c998288467"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
