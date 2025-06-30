import { db } from "./firebase"; // firebase.jsで初期化されたdb
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const handleSubmit = async () => {
  try {
    await addDoc(collection(db, "reservations"), {
      name,
      department,
      purpose,
      visitor,
      room,
      time,
      createdAt: serverTimestamp(),
    });
    alert("予約が保存されました");
  } catch (error) {
    console.error("保存エラー:", error);
    alert("保存に失敗しました");
  }
};
