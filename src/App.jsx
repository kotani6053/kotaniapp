import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

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

  /* ---------- 時間リスト ---------- */
  const timeOptions = [];
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 10) {
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (time >= "08:30" && time <= "18:00") timeOptions.push(time);
    }
  }

  /* ---------- Firestore購読 ---------- */
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "reservations"), (snapshot) => {
      setReservations(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(""), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);

  /* ---------- 入力 ---------- */
  const handleChange = (e) => {
    setErrorMessage("");
    setSuccessMessage("");
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  /* ---------- 重複チェック ---------- */
  const isOverlapping = (newRes) =>
    reservations.some(
      r =>
        r.date === newRes.date &&
        (r.name === newRes.name || r.room === newRes.room) &&
        !(newRes.endTime <= r.startTime || newRes.startTime >= r.endTime)
    );

  /* ---------- 登録 ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.startTime >= formData.endTime) {
      setErrorMessage("❌ 終了時間は開始時間より後にしてください");
      return;
    }
    if (isOverlapping(formData)) {
      setErrorMessage("⚠️ 同時間・同部屋（または同名）の予約があります");
      return;
    }

    await addDoc(collection(db, "reservations"), formData);
    setSuccessMessage("✅ 予約が完了しました");
    setFormData({ ...formData, name: "", purpose: "", guest: "" });
  };

  /* ---------- 削除 ---------- */
  const handleDelete = async (id) => {
    if (!window.confirm("この予約を削除しますか？")) return;
    await deleteDoc(doc(db, "reservations", id));
  };

  /* ---------- 日付 → 部屋で整理 ---------- */
  const groupedReservations = () => {
    const grouped = {};
    reservations.forEach(r => {
      if (!grouped[r.date]) grouped[r.date] = {};
      if (!grouped[r.date][r.room]) grouped[r.date][r.room] = [];
      grouped[r.date][r.room].push(r);
    });
    return grouped;
  };

  /* ===================== UI ===================== */
  return (
    <div className="p-10 bg-gray-50 min-h-screen text-xl">
      <h1 className="text-5xl font-bold mb-10">📖 KOTANI会議室予約</h1>

      <div className="grid md:grid-cols-2 gap-10">
        {/* ---------- 入力 ---------- */}
        <div>
          <h2 className="text-3xl font-semibold mb-6">📌 予約入力</h2>

          {successMessage && <div className="bg-green-100 p-4 mb-4 rounded">{successMessage}</div>}
          {errorMessage && <div className="bg-red-100 p-4 mb-4 rounded">{errorMessage}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="name" placeholder="名前" value={formData.name} onChange={handleChange} required className="w-full p-4 border rounded" />
            <input name="purpose" placeholder="使用目的" value={formData.purpose} onChange={handleChange} required className="w-full p-4 border rounded" />
            <input name="guest" placeholder="来客者名" value={formData.guest} onChange={handleChange} className="w-full p-4 border rounded" />

            <select name="department" value={formData.department} onChange={handleChange} className="w-full p-4 border rounded">
              <option>新門司手摺</option>
              <option>新門司セラミック</option>
              <option>総務部</option>
              <option>役員</option>
              <option>その他</option>
            </select>

            <select name="room" value={formData.room} onChange={handleChange} className="w-full p-4 border rounded">
              <option>1階食堂</option>
              <option>2階会議室①</option>
              <option>2階会議室②</option>
              <option>3階応接室</option>
            </select>

            <input type="date" name="date" min={today} value={formData.date} onChange={handleChange} className="w-full p-4 border rounded" />

            <div className="flex gap-4">
              <select name="startTime" value={formData.startTime} onChange={handleChange} className="flex-1 p-4 border rounded">
                {timeOptions.map(t => <option key={t}>{t}</option>)}
              </select>
              <select name="endTime" value={formData.endTime} onChange={handleChange} className="flex-1 p-4 border rounded">
                {timeOptions.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <button className="w-full py-6 text-4xl bg-blue-600 text-white rounded-xl">🚀 予約する</button>
          </form>
        </div>

        {/* ---------- タイムライン ---------- */}
        <div>
          <h2 className="text-3xl font-semibold mb-6">📅 部屋別タイムライン</h2>

          {Object.entries(groupedReservations()).map(([date, rooms]) => (
            <div key={date} className="mb-12">
              <h3 className="text-2xl font-bold mb-4">
                📅 {new Date(date).toLocaleDateString("ja-JP")}
              </h3>

              {Object.entries(rooms).map(([room, entries]) => (
                <div key={room} className="mb-8 bg-white rounded-xl border">
                  <div className="p-4 text-2xl font-bold bg-blue-100">🏢 {room}</div>

                  {timeOptions.map(time => {
                    const r = entries.find(e => e.startTime <= time && e.endTime > time);
                    return (
                      <div key={time} className="flex items-center border-t h-12">
                        <div className="w-24 text-center bg-gray-100">{time}</div>
                        <div className="flex-1 px-4">
                          {r ? (
                            <div className="bg-blue-500 text-white px-3 py-1 rounded flex justify-between">
                              <span>{r.name} / {r.purpose}</span>
                              <button onClick={() => handleDelete(r.id)} className="text-sm underline">削除</button>
                            </div>
                          ) : (
                            <span className="text-gray-400">空き</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
