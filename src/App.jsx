import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  doc,
} from "firebase/firestore";

/* =====================
   超巨大UI用 共通style
===================== */
const BIG = {
  fontSize: "42px",
  padding: "28px",
  height: "100px",
};

const App = () => {
  const today = new Date().toISOString().split("T")[0];

  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    name: "",
    room: "1階食堂",
    start: "09:00",
    end: "09:30",
  });

  /* ===== 30分刻み ===== */
  const times = [];
  for (let h = 8; h <= 18; h++) {
    ["00", "30"].forEach((m) => {
      const t = `${String(h).padStart(2, "0")}:${m}`;
      if (t >= "08:30" && t <= "18:00") times.push(t);
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

  const handleAdd = async () => {
    if (!form.name) return alert("名前を入力してください");
    if (form.start >= form.end)
      return alert("時間が不正です");

    await addDoc(collection(db, "reservations"), {
      name: form.name,
      room: form.room,
      startTime: form.start,
      endTime: form.end,
      date: today,
    });

    setForm({ ...form, name: "" });
  };

  const byRoom = {};
  list.forEach((r) => {
    if (!byRoom[r.room]) byRoom[r.room] = [];
    byRoom[r.room].push(r);
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f8",
        padding: "40px",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: "64px", marginBottom: "40px" }}>
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
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            style={{ ...BIG, width: "100%" }}
          />

          <select
            value={form.room}
            onChange={(e) =>
              setForm({ ...form, room: e.target.value })
            }
            style={{ ...BIG, width: "100%", marginTop: "20px" }}
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
              marginTop: "20px",
            }}
          >
            <select
              value={form.start}
              onChange={(e) =>
                setForm({ ...form, start: e.target.value })
              }
              style={BIG}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>

            <select
              value={form.end}
              onChange={(e) =>
                setForm({ ...form, end: e.target.value })
              }
              style={BIG}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAdd}
            style={{
              marginTop: "30px",
              width: "100%",
              height: "120px",
              fontSize: "48px",
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
                        color: "red",
                        fontSize: "28px",
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
};

createRoot(document.getElementById("root")).render(<App />);
