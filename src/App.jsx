import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";

/* ===== 入力共通スタイル（超重要） ===== */
const inputClass =
  "w-full text-3xl px-6 py-6 border-2 border-gray-400 rounded-2xl " +
  "focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-200";

const App = () => {
  const [reservations, setReservations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    name: "",
    department: "新門司手摺",
    purpose: "",
    guest: "",
    room: "1階食堂",
    date: today,
    startTime: "08:30",
    endTime: "09:00",
  });

  /* ===== 30分刻み時間 ===== */
  const timeOptions = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const h = String(hour).padStart(2, "0");
      const m = String(min).padStart(2, "0");
      const time = `${h}:${m}`;
      if (time >= "08:30" && time <= "18:00") {
        timeOptions.push(time);
      }
    }
  }

  /* ===== Firestore 監視 ===== */
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "reservations"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setReservations(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(""), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setErrorMessage("");
    setSuccessMessage("");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* ===== 重複チェック ===== */
  const isOverlapping = (newRes) => {
    return reservations.some(
      (r) =>
        r.date === newRes.date &&
        (r.name === newRes.name || r.room === newRes.room) &&
        !(newRes.endTime <= r.startTime || newRes.startTime >= r.endTime)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.startTime >= formData.endTime) {
      setErrorMessage("❌ 終了時間は開始時間より後にしてください");
      return;
    }

    if (isOverlapping(formData)) {
      setErrorMessage("⚠️ 同じ時間に同じ部屋または同じ名前の予約があります");
      return;
    }

    try {
      await addDoc(collection(db, "reservations"), formData);
      setSuccessMessage("✅ 予約が完了しました");
      setFormData({
        name: "",
        department: "新門司手摺",
        purpose: "",
        guest: "",
        room: "1階食堂",
        date: today,
        startTime: "08:30",
        endTime: "09:00",
      });
    } catch (err) {
      console.error(err);
      setErrorMessage("❌ 保存に失敗しました");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("この予約を削除しますか？")) return;
    await deleteDoc(doc(db, "reservations", id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10 font-sans">
      <h1 className="text-5xl font-extrabold mb-10">
        📖 KOTANI 会議室予約
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* ===== 予約入力 ===== */}
        <div className="bg-white p-10 rounded-3xl shadow-2xl">
          <h2 className="text-4xl font-extrabold mb-8">📌 予約入力</h2>

          {successMessage && (
            <div className="bg-green-100 text-green-800 p-6 rounded-2xl text-2xl font-bold mb-6">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-100 text-red-800 p-6 rounded-2xl text-2xl font-bold mb-6">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-8">
            <input name="name" placeholder="名前" value={formData.name} onChange={handleChange} required className={inputClass} />
            <select name="department" value={formData.department} onChange={handleChange} className={inputClass}>
              <option>新門司手摺</option>
              <option>新門司セラミック</option>
              <option>総務部</option>
              <option>役員</option>
              <option>その他</option>
            </select>
            <input name="purpose" placeholder="使用目的" value={formData.purpose} onChange={handleChange} required className={inputClass} />
            <input name="guest" placeholder="来客者名（あれば）" value={formData.guest} onChange={handleChange} className={inputClass} />

            <select name="room" value={formData.room} onChange={handleChange} className={inputClass}>
              <option>1階食堂</option>
              <option>2階会議室①</option>
              <option>2階会議室②</option>
              <option>3階応接室</option>
            </select>

            <input type="date" name="date" value={formData.date} min={today} onChange={handleChange} className={inputClass} />

            <div className="grid grid-cols-2 gap-6">
              <select name="startTime" value={formData.startTime} onChange={handleChange} className={inputClass}>
                {timeOptions.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select name="endTime" value={formData.endTime} onChange={handleChange} className={inputClass}>
                {timeOptions.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-indigo-600
                         text-white text-5xl font-extrabold py-10 rounded-3xl
                         shadow-2xl hover:scale-105 transition"
            >
              🚀 予約する
            </button>
          </form>
        </div>

        {/* ===== 一覧 ===== */}
        <div>
          <h2 className="text-4xl font-bold mb-6">📅 予約一覧</h2>
          {reservations.map((r) => (
            <div key={r.id} className="bg-white p-6 rounded-2xl shadow mb-4">
              <div className="text-2xl font-bold">
                {r.date} / {r.room}
              </div>
              <div className="text-xl">
                {r.startTime}〜{r.endTime} ｜ {r.name}
              </div>
              <button onClick={() => handleDelete(r.id)} className="text-red-600 text-lg mt-2">
                削除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root"));
root.render(<App />);
