import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { db } from "./firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

const App = () => {
  const [reservations, setReservations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    name: "",
    department: "役員",
    purpose: "",
    guest: "",
    room: "1階食堂",
    date: today,
    startTime: "08:30",
    endTime: "09:00"
  });

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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReservations(data);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrorMessage(""); // エラーをリセット
  };

  const isOverlapping = (newRes) => {
    return reservations.some((r) =>
      r.date === newRes.date &&
      r.name === newRes.name &&
      !(
        newRes.endTime <= r.startTime || newRes.startTime >= r.endTime
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.startTime >= formData.endTime) {
      setErrorMessage("❌ 終了時間は開始時間より後にしてください。");
      return;
    }

    if (isOverlapping(formData)) {
      setErrorMessage("⚠️ 同じ名前で同じ日の時間が重なる予約があります（部屋が違ってもNG）。");
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
        date: today,
        startTime: "08:30",
        endTime: "09:00"
      });
    } catch (error) {
      console.error("Firestore書き込み失敗:", error);
      setErrorMessage("❌ 保存に失敗しました。後ほど確認してください。");
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "reservations", id));
  };

  const groupedReservations = () => {
    const grouped = {};
    reservations
      .filter((r) => r.date && r.room)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        return a.startTime.localeCompare(b.startTime);
      })
      .forEach((r) => {
        if (!grouped[r.date]) grouped[r.date] = {};
        if (!grouped[r.date][r.room]) grouped[r.date][r.room] = [];
        grouped[r.date][r.room].push(r);
      });
    return grouped;
  };

  return (
    <div className="p-10 font-sans text-xl bg-gray-50 min-h-screen">
      <h1 className="text-5xl font-bold mb-10 text-blue-700">📖 KOTANI会議室予約アプリ</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* フォーム */}
        <div>
          <h2 className="text-3xl font-semibold mb-4">📌 予約入力</h2>

          {errorMessage && <p className="text-red-600 font-bold mb-4">{errorMessage}</p>}

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

            <input type="date" name="date" min={today} value={formData.date} onChange={handleChange} required className="text-xl p-4 border rounded-xl" />

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-lg font-medium mb-1">開始時間</label>
                <select name="startTime" value={formData.startTime} onChange={handleChange} className="text-xl p-4 border rounded-xl w-full">
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-lg font-medium mb-1">終了時間</label>
                <select name="endTime" value={formData.endTime} onChange={handleChange} className="text-xl p-4 border rounded-xl w-full">
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <button className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-3xl font-bold px-10 py-6 rounded-3xl hover:scale-105 transition">
              🚀 予約する
            </button>
          </form>
        </div>

        {/* 予約一覧 */}
        <div>
          <h2 className="text-3xl font-semibold mb-4">📅 予約一覧</h2>
          {Object.entries(groupedReservations()).map(([date, rooms]) => (
            <div key={date} className="mb-10">
              <h3 className="text-2xl font-bold mb-4 bg-blue-100 px-4 py-2 rounded-xl text-blue-800 inline-block">
                📅 {new Date(date).toLocaleDateString("ja-JP", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
              </h3>
              {Object.entries(rooms).map(([room, entries]) => (
                <div key={room} className="mb-6 p-4 border border-gray-300 rounded-xl shadow bg-white">
                  <h4 className="text-xl font-semibold text-blue-700 mb-3">🏢 {room}</h4>

                  {/* ヘッダー */}
                  <div className="flex font-bold text-gray-600 border-b pb-2">
                    <div className="w-32">時間</div>
                    <div className="w-32">名前</div>
                    <div className="w-32">所属</div>
                    <div className="flex-1">使用目的</div>
                    <div className="flex-1">来客者名</div>
                    <div className="w-20 text-center">操作</div>
                  </div>

                  {/* 各予約 */}
                  {entries.map(r => (
                    <div key={r.id} className="flex items-center py-2 border-b text-gray-800 text-sm">
                      <div className="w-32">{r.startTime}〜{r.endTime}</div>
                      <div className="w-32">{r.name}</div>
                      <div className="w-32">{r.department}</div>
                      <div className="flex-1 truncate">{r.purpose}</div>
                      <div className="flex-1 truncate">{r.guest || "-"}</div>
                      <div className="w-20 text-center">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-red-600 hover:underline"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
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
