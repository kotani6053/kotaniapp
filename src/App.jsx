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

  const rooms = [
    "1階食堂",
    "2階会議室①",
    "2階会議室②",
    "3階応接室",
  ];

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
    if (!name) return alert("名前を入力してください");
    if (start >= end) return alert("時間が正しくありません");

    await addDoc(collection(db, "reservations"), {
      name,
      room,
      startTime: start,
      endTime: end,
      date: today,
    });

    setName("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        padding: "40px 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ===== タイトル ===== */}
      <h1
        style={{
          textAlign: "center",
          fontSize: 26,
          fontWeight: 600,
          marginBottom: 30,
        }}
      >
        会議室予約（本日）
      </h1>

      {/* ===== 入力カード ===== */}
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto 40px",
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <input
          placeholder="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <select
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          style={inputStyle}
        >
          {rooms.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 12 }}>
          <select
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={inputStyle}
          >
            {times.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <select
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={inputStyle}
          >
            {times.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <button
          onClick={addReservation}
          style={{
            marginTop: 16,
            width: "100%",
            height: 46,
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          予約する
        </button>
      </div>

      {/* ===== タイムライン ===== */}
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {rooms.map((roomName) => (
          <div key={roomName} style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {roomName}
            </h2>

            <div
              style={{
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }}
            >
              {list
                .filter((r) => r.room === roomName)
                .sort((a, b) =>
                  a.startTime.localeCompare(b.startTime)
                )
                .map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderBottom:
                        "1px solid #eee",
                      fontSize: 15,
                    }}
                  >
                    <span>
                      {r.startTime}〜{r.endTime} ／{" "}
                      <strong>{r.name}</strong>
                    </span>
                    <button
                      onClick={() =>
                        deleteDoc(
                          doc(db, "reservations", r.id)
                        )
                      }
                      style={{
                        border: "none",
                        background: "none",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      削除
                    </button>
                  </div>
                ))}

              {list.filter((r) => r.room === roomName)
                .length === 0 && (
                <div
                  style={{
                    padding: 14,
                    fontSize: 14,
                    color: "#999",
                  }}
                >
                  予約なし
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== 共通入力スタイル ===== */
const inputStyle = {
  width: "100%",
  height: 42,
  fontSize: 15,
  padding: "0 10px",
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid #ccc",
};
