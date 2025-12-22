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

/* ===== 入力は inline style で強制的に巨大化 ===== */
const inputStyle = {
  fontSize: "36px",
  padding: "28px",
  height: "90px",
};

const selectStyle = {
  fontSize: "36px",
  padding: "20px",
  height: "90px",
};

const App = () => {
  const today = new Date().toISOString().split("T")[0];

  const [reservations, setReservations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  /* ===== 30分刻み ===== */
  const timeOptions = [];
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const t = `${hh}:${mm}`;
      if (t >= "08:30" && t <= "18:00") timeOptions.push(t);
    }
  }

  /* ===== Firestore ===== */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reservations"), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
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
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const isOverlapping = (n) =>
    reservations.some(
      (r) =>
        r.date === n.date &&
        (r.room === n.room || r.name === n.name) &&
        !(n.endTime <= r.startTime || n.startTime >= r.endTime)
    );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.startTime >= formData.endTime) {
      setErrorMessage("❌ 終了時間は開始時間より後にしてください");
      return;
    }

    if (isOverlapping(formData)) {
      setErrorMessage("⚠️ 同じ時間に同じ部屋、または同じ名前の予約があります");
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
    } catch {
      setErrorMessage("❌ 保存に失敗しました");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, "reservations", id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <h1 className="text-6xl font-extrabold mb-10">
        📖 KOTANI 会議室予約
      </h1>

      {/* ★ 幅制限なし（ここ重要） */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* ===== 入力 ===== */}
        <div className="bg-white p-12 rounded-3xl shadow-2xl">
          <h2 className="text-5xl font-extrabold mb-10">📌 予約入力</h2>

          {successMessage && (
            <div className="bg-green-100 p-6 rounded-2xl text-3xl font-bold mb-6">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-100 p-6 rounded-2xl text-3xl font-bold mb-6">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-10">
            <input
              name="name"
              placeholder="名前"
              value={formData.name}
              onChange={handleChange}
              required
              style={inputStyle}
              className="w-full border-2 rounded-2xl"
            />

            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              style={selectStyle}
              className="w-full border-2 rounded-2xl"
            >
              <option>新門司手摺</option>
              <option>新門司セラミック</option>
              <option>総務部</option>
              <option>役員</option>
              <option>その他</option>
            </select>

            <input
              name="purpose"
              placeholder="使用目的"
              value={formData.purpose}
              onChange={handleChange}
              required
              style={inputStyle}
              className="w-full border-2 rounded-2xl"
            />

            <input
              name="guest"
              placeholder="来客者名（あれば）"
              value={formData.guest}
              onChange={handleChange}
              style={inputStyle}
              className="w-full border-2 rounded-2xl"
            />

            <select
              name="room"
              value={formData.room}
              onChange={handleChange}
              style={selectStyle}
              className="w-full border-2 rounded-2xl"
            >
              <option>1階食堂</option>
              <option>2階会議室①</option>
              <option>2階会議室②</option>
              <option>3階応接室</option>
            </select>

            <input
              type="date"
              name="date"
              value={formData.date}
              min={today}
              onChange={handleChange}
              style={inputStyle}
              className="w-full border-2 rounded-2xl"
            />

            <div className="grid grid-cols-2 gap-8">
              <select
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                style={selectStyle}
                className="w-full border-2 rounded-2xl"
              >
                {timeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              <select
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                style={selectStyle}
                className="w-full border-2 rounded-2xl"
              >
                {timeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-indigo-600
                         text-white text-6xl font-extrabold py-10 rounded-3xl
                         shadow-2xl"
            >
              🚀 予約する
            </button>
          </form>
        </div>

        {/* ===== 一覧 ===== */}
        <div>
          <h2 className="text-5xl font-bold mb-6">📅 予約一覧</h2>
          {reservations.map((r) => (
            <div
              key={r.id}
              className="bg-white p-6 rounded-2xl shadow mb-4"
            >
              <div className="text-2xl font-bold">
                {r.date} / {r.room}
              </div>
              <div className="text-xl">
                {r.startTime}〜{r.endTime} ｜ {r.name}
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                className="text-red-600 text-lg mt-2"
              >
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
