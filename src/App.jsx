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

  /* =====================
     State
  ===================== */
  const [name, setName] = useState("");
  const [room, setRoom] = useState("1階食堂");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [list, setList] = useState([]);

  /* =====================
     30分刻み時間
  ===================== */
  const times = [];
  for (let h = 8; h <= 18; h++) {
    ["00", "30"].forEach((m) => {
      const t = `${String(h).padStart(2, "0")}:${m}`;
      if (t >= "08:30" && t <= "18:00") times.push(t);
    });
  }

  /* =====================
     Firestore 読み込み
  ===================== */
  useEffect(() => {
    return onSnapshot(collection(db, "reservations"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.date === today);
      setList(data);
    });
  }, []);

  /* =====================
     追加
  ===================== */
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

  /* =====================
     部屋ごとに整理
  ===================== */
  const byRoom = {};
  list.forEach((r) => {
    if (!byRoom[r.room]) byRoom[r.room] = [];
    byRoom[r.room].push(r);
  });

  /* =====================
     UI
  ===================== */
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px",
        background: "#f4f6f8",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: "64px", marginBottom: "30px" }}>
        📺 会議室予約（本日）
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "40px",
        }}
      >
        {/* ===== 入力 ===== */}
        <div
          style={{
            background: "white",
            padding: "40px",
            borderRadius: "24px",
          }}
        >
          <h2 style={{ fontSize: "52px", marginBottom: "30px" }}>
            予約入力
          </h2>

          <input
            placeholder="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              height: "120px",
              fontSize: "48px",
              padding: "20px",
              marginBottom: "20px",
            }}
          />

          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={{
              width: "100%",
              height: "120px",
              fontSize: "48px",
              marginBottom: "20px",
            }}
          >
            <option>1階食堂</option>
            <option>2階会議室①</option>
            <option>2階会議室②</option>
            <option>3階応接室</option>
          </select>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <select
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{ height: "120px", fontSize: "48px" }}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>

            <select
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{ height: "120px", fontSize: "48px" }}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            onClick={addReservation}
            style={{
              marginTop: "30px",
              width: "100%",
              height: "140px",
              fontSize: "56px",
              borderRadius: "24px",
              background: "#2563eb",
              color: "white",
            }}
          >
            予約する
          </button>
        </div>

        {/* ===== タイムライン ===== */}
        <div>
          {Object.entries(byRoom).map(([room, rows]) => (
            <div
              key={room}
              style={{
                background: "white",
                padding: "30px",
                borderRadius: "24px",
                marginBottom: "30px",
              }}
            >
              <h3 style={{ fontSize: "42px", marginBottom: "20px" }}>
                🏢 {room}
              </h3>

              {rows
                .sort((a, b) =>
                  a.startTime.localeCompare(b.startTime)
                )
                .map((r) => (
                  <div
                    key={r.id}
                    style={{
                      fontSize: "34px",
                      padding: "20px",
                      background: "#f1f5f9",
                      borderRadius: "16px",
                      marginBottom: "10px",
                    }}
                  >
                    {r.startTime}〜{r.endTime} ／ {r.name}
                    <button
                      onClick={() =>
                        deleteDoc(
                          doc(db, "reservations", r.id)
                        )
                      }
                      style={{
                        marginLeft: "20px",
                        fontSize: "28px",
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
      </div>
    </div>
  );
}
