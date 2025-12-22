import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  doc,
} from "firebase/firestore";

export default function App() {
  const today = new Date().toISOString().split("T")[0];

  const [name, setName] = useState("");
  const [room, setRoom] = useState("1階食堂");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [list, setList] = useState([]);

  /* ===== 30分刻み ===== */
  const times = [];
  for (let h = 8; h <= 18; h++) {
    ["00", "30"].forEach((m) => {
      times.push(`${String(h).padStart(2, "0")}:${m}`);
    });
  }

  /* ===== Firestore ===== */
  useEffect(() => {
    return onSnapshot(collection(db, "reservations"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.date === today);
      setList(data);
    });
  }, []);

  const addReservation = async () => {
    if (!name) {
      alert("名前を入力してください");
      return;
    }
    if (start >= end) {
      alert("時間が正しくありません");
      return;
    }

    await addDoc(collection(db, "reservations"), {
      name,
      room,
      startTime: start,
      endTime: end,
      date: today,
    });

    setName("");
  };

  const rooms = [
    "1階食堂",
    "2階会議室①",
    "2階会議室②",
    "3階応接室",
  ];

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>
        会議室予約（本日）
      </h1>

      {/* ===== 入力 ===== */}
      <div style={{ marginBottom: 24 }}>
        <input
          placeholder="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            height: 44,
            fontSize: 18,
            marginBottom: 8,
          }}
        />

        <select
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          style={{
            width: "100%",
            height: 44,
            fontSize: 18,
            marginBottom: 8,
          }}
        >
          {rooms.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={{ flex: 1, height: 44, fontSize: 18 }}
          >
            {times.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <select
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={{ flex: 1, height: 44, fontSize: 18 }}
          >
            {times.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <button
          onClick={addReservation}
          style={{
            marginTop: 10,
            width: "100%",
            height: 48,
            fontSize: 20,
          }}
        >
          予約する
        </button>
      </div>

      {/* ===== 一覧 ===== */}
      {rooms.map((roomName) => (
        <div key={roomName} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>
            {roomName}
          </h2>

          {list
            .filter((r) => r.room === roomName)
            .sort((a, b) =>
              a.startTime.localeCompare(b.startTime)
            )
            .map((r) => (
              <div
                key={r.id}
                style={{
                  fontSize: 16,
                  padding: "6px 0",
                  borderBottom: "1px solid #ddd",
                }}
              >
                {r.startTime}〜{r.endTime} ／ {r.name}
                <button
                  onClick={() =>
                    deleteDoc(doc(db, "reservations", r.id))
                  }
                  style={{
                    marginLeft: 8,
                    fontSize: 14,
                    color: "red",
                  }}
                >
                  削除
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
