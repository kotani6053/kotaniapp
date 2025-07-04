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

const App = () => {
  const [reservations, setReservations] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    department: "役員",
    purpose: "",
    guest: "",
    room: "1階食堂",
    date: "",
    startTime: "08:30",
    endTime: "09:00",
  });

  const today = new Date().toISOString().split("T")[0];

  const timeOptions = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let min = 0; min < 60; min += 10) {
      const h = String(hour).padStart(2, "0");
      const m = String(min).padStart(2, "0");
      const time = `${h}:${m}`;
      if (time >= "08:30" && time <= "18:00") {
        timeOptions.push(time);
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "reservations"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReservations(data);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const isOverlapping = (newRes) => {
    return reservations.some((r) =>
      r.name === newRes.name &&
      r.date === newRes.date &&
      !(newRes.endTime <= r.startTime || newRes.startTime >= r.endTime)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.startTime >= formData.endTime) {
      alert("❌ 終了時間は開始時間より後にしてください。");
      return;
    }

    if (isOverlapping(formData)) {
      alert("⚠️ 同じ名前で同じ日・同じ時間帯の予約があります（部屋が違ってもNG）");
      return;
    }

    try {
      await addDoc(collection(db, "reservations"), formData);
      alert("✅ 予約が完了しました。");
      setFormData({
        name: "",
        department: "役員",
        purpose: "",
        guest: "",
        room: "1階食堂",
        date: "",
        startTime: "08:30",
        endTime: "09:00",
      });
    } catch (error) {
      console.error("Firestore書き込み失敗:", error);
      alert("❌ 保存に失敗しました。後ほど確認してください。");
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "reservations", id));
  };

  const groupedReservations = () => {
    const safeString = (v) => (typeof v === "string" ? v : v?.toString?.() || "");
    const sorted = [...reservations].sort((a, b) => {
      const byDate = safeString(a.date).localeCompare(safeString(b.date));
      if (byDate !== 0) return byDate;
      const byRoom = safeString(a.room).localeCompare(safeString(b.room));
      if (byRoom !== 0) return byRoom;
      return safeString(a.startTime).localeCompare(safeString(b.startTime));
    });

    const grouped = {};
    sorted.forEach((r) => {
      const date = safeString(r.date);
      const room = safeString(r.room);
      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][room]) grouped[date][room] = [];
      grouped[date][room].push(r);
    });

    return grouped;
  };

  return (
    <div className="p-10 font-sans text-xl">
      <h1 className="text-5xl font-bold mb-10">📖 KOTANI会議室予約アプリ</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* フォーム */}
        <div>
          <h2 className="text-3xl font-semibold mb-6">📌 予約入力</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
            <input name="name" placeholder="名前" value={formData.name} onChange={handleChange} required className="text-xl p-4 border rounded-xl" />
            <select name="department" value={formData.department} onChange={handleChange} className="text-xl p-4 border rounded-xl">
              <option value="役員">役員</option>
              <option value="新門司手摺">新門司手摺</option>
              <option value="新門司セラミック">新門司セラミック</option>
              <option value="総務部">総務部</option>
              <option value="その他">その他</option>
            </select>
            <input name="purpose" placeholder="使用目的" value={formData.purpose} onChange={handleChange} required className="text-xl p-4 border rounded-xl" />
            <input name="guest" placeholder="来客者名" value={formData.guest} onChange={handleChange} className="text-xl p-4 border rounded-xl" />
            <select name="room" value={formData.room} onChange={handleChange} className="text-xl p-4 border rounded-xl">
              <option value="1階食堂">1階食堂</option>
              <option value="2階会議室①">2階会議室①</option>
              <option value="2階会議室②">2階会議室②</option>
              <option value="3階会議室">3階会議室</option>
              <option value="応接室">応接室</option>
            </select>
            <input
              name="date"
              type="date"
              min={today}
              value={formData.date}
              onChange={handleChange}
              required
              className="text-xl p-4 border rounded-xl"
            />

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-lg font-medium mb-2">開始時間</label>
                <select name="startTime" value={formData.startTime} onChange={handleChange} className="text-xl p-4 border rounded-xl w-full">
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-lg font-medium mb-2">終了時間</label>
                <select name="endTime" value={formData.endTime} onChange={handleChange} className="text-xl p-4 border rounded-xl w-full">
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <button className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-5xl font-extrabold px-20 py-10 rounded-3xl shadow-2xl hover:scale-110 hover:brightness-110 transition-transform duration-300 ease-in-out">
              🚀 予約する
            </button>
          </form>
        </div>

        {/* 一覧 */}
        <div>
          <h2 className="text-3xl font-semibold mb-6">📅 予約一覧</h2>
          {Object.entries(groupedReservations()).map(([date, rooms]) => (
            <div key={date} className="mb-8">
              <h3 className="text-2xl font-bold mb-3">📅 {date}</h3>
              {Object.entries(rooms).map(([room, entries]) => (
                <div key={room} className="mb-3">
                  <h4 className="text-xl font-semibold mb-2">🏢 {room}</h4>
                  <ul className="ml-6">
                    {entries.map((r) => (
                      <li key={r.id} className="mb-2">
                        {r.startTime}〜{r.endTime} - {r.name}（{r.department}） / {r.purpose} {r.guest && `/ 来客: ${r.guest}`}
                        <button onClick={() => handleDelete(r.id)} className="text-red-600 ml-4 hover:underline text-lg">削除</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
