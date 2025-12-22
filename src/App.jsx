import React, { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

function App() {
  const [reservations, setReservations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    name: "",
    department: "新門司製造部",
    purpose: "",
    room: "1階食堂",
    date: today,
    startTime: "09:00",
    endTime: "09:30",
  });

  // 30分刻み
  const timeOptions = [];
  for (let h = 9; h <= 18; h++) {
    ["00", "30"].forEach((m) => {
      const t = `${String(h).padStart(2, "0")}:${m}`;
      if (t <= "18:00") timeOptions.push(t);
    });
  }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reservations"), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleChange = (e) => {
    setErrorMessage("");
    setSuccessMessage("");
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isOverlapping = (newRes) => {
    return reservations.some(
      (r) =>
        r.date === newRes.date &&
        r.room === newRes.room &&
        !(newRes.endTime <= r.startTime || newRes.startTime >= r.endTime)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.startTime >= formData.endTime) {
      setErrorMessage("終了時間は開始時間より後にしてください");
      return;
    }

    if (isOverlapping(formData)) {
      setErrorMessage("同じ時間帯に同じ部屋の予約があります");
      return;
    }

    await addDoc(collection(db, "reservations"), formData);
    setSuccessMessage("予約しました");
    setFormData({
      name: "",
      department: "新門司製造部",
      purpose: "",
      room: "1階食堂",
      date: today,
      startTime: "09:00",
      endTime: "09:30",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("本当に削除しますか？")) return;
    await deleteDoc(doc(db, "reservations", id));
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold mb-8">会議室予約</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 入力 */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow">
          <h2 className="text-2xl font-semibold mb-4">予約入力</h2>

          {errorMessage && (
            <div className="mb-3 text-red-600">{errorMessage}</div>
          )}
          {successMessage && (
            <div className="mb-3 text-green-600">{successMessage}</div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              name="name"
              placeholder="名前"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full appearance-none border rounded px-3 py-2"
            />

            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full appearance-none border rounded px-3 py-2"
            >
              <option>新門司製造部</option>
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
              className="w-full appearance-none border rounded px-3 py-2"
            />

            <select
              name="room"
              value={formData.room}
              onChange={handleChange}
              className="w-full appearance-none border rounded px-3 py-2"
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
              onChange={handleChange}
              className="w-full appearance-none border rounded px-3 py-2"
            />

            <div className="flex gap-2">
              <select
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full appearance-none border rounded px-3 py-2"
              >
                {timeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              <select
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full appearance-none border rounded px-3 py-2"
              >
                {timeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg"
              >
                予約する
              </button>
            </div>
          </form>
        </div>

        {/* 一覧 */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-2xl font-semibold mb-4">予約一覧</h2>

          {reservations
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((r) => (
              <div key={r.id} className="mb-3 border-b pb-2">
                <div className="font-semibold">
                  {r.date} {r.startTime}〜{r.endTime}
                </div>
                <div className="text-sm text-gray-600">
                  {r.room} / {r.name}
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-sm text-red-500 mt-1"
                >
                  削除
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default App;
