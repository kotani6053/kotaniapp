import React, { useEffect, useState } from "react";
import { collection, addDoc, deleteDoc, onSnapshot, doc } from "firebase/firestore";
import { db } from "./firebase";

function App() {
  /* =====================
     共通スタイル（幅ズレ完全防止）
  ====================== */
  const fieldStyle = {
    width: "100%",
    height: "42px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    padding: "0 12px",
    boxSizing: "border-box",
    fontSize: "14px",
    backgroundColor: "#fff",
  };

  /* =====================
     state
  ====================== */
  const today = new Date().toISOString().split("T")[0];

  const [reservations, setReservations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    department: "新門司製造部",
    purpose: "",
    room: "1階食堂",
    date: today,
    startTime: "09:00",
    endTime: "09:30",
  });

  /* =====================
     30分刻み時間
  ====================== */
  const timeOptions = [];
  for (let h = 8; h <= 18; h++) {
    ["00", "30"].forEach((m) => {
      const t = `${String(h).padStart(2, "0")}:${m}`;
      if (t >= "08:30" && t <= "18:00") timeOptions.push(t);
    });
  }

  /* =====================
     Firestore取得
  ====================== */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reservations"), (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  /* =====================
     入力変更
  ====================== */
  const handleChange = (e) => {
    setErrorMessage("");
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  /* =====================
     重複チェック（同日・同部屋）
  ====================== */
  const isOverlapping = () => {
    return reservations.some(
      (r) =>
        r.date === formData.date &&
        r.room === formData.room &&
        !(formData.endTime <= r.startTime || formData.startTime >= r.endTime)
    );
  };

  /* =====================
     登録
  ====================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.startTime >= formData.endTime) {
      setErrorMessage("終了時間は開始時間より後にしてください");
      return;
    }

    if (isOverlapping()) {
      setErrorMessage("同じ時間帯にすでに予約があります");
      return;
    }

    await addDoc(collection(db, "reservations"), formData);

    setFormData({
      name: "",
      department: "新門司製造部",
      purpose: "",
      room: "1階食堂",
      date: formData.date,
      startTime: "09:00",
      endTime: "09:30",
    });
  };

  /* =====================
     削除（再確認）
  ====================== */
  const handleDelete = async (id) => {
    if (!window.confirm("この予約を削除してもよいですか？")) return;
    await deleteDoc(doc(db, "reservations", id));
  };

  /* =====================
     表示用（選択日）
  ====================== */
  const dayReservations = reservations
    .filter((r) => r.date === formData.date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div style={{ padding: 32, background: "#f9fafb", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24 }}>
        KOTANI 会議室予約
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        {/* ================= 入力 ================= */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            予約入力
          </h2>

          {errorMessage && (
            <div style={{ color: "#dc2626", marginBottom: 12 }}>
              {errorMessage}
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            <input
              name="name"
              placeholder="名前"
              value={formData.name}
              onChange={handleChange}
              style={fieldStyle}
              required
            />

            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              style={fieldStyle}
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
              style={fieldStyle}
              required
            />

            <select
              name="room"
              value={formData.room}
              onChange={handleChange}
              style={fieldStyle}
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
              style={fieldStyle}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <select
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                style={fieldStyle}
              >
                {timeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              <select
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                style={fieldStyle}
              >
                {timeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              style={{
                marginTop: 8,
                background: "#16a34a",
                color: "#fff",
                borderRadius: 10,
                padding: "12px 0",
                fontSize: 18,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              予約する
            </button>
          </div>
        </form>

        {/* ================= 一覧 ================= */}
        <div
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            {formData.date} の予約
          </h2>

          {dayReservations.length === 0 && (
            <div style={{ color: "#6b7280" }}>予約はありません</div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {dayReservations.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {r.startTime} – {r.endTime} / {r.room}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {r.name}（{r.department}） / {r.purpose}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  style={{
                    color: "#dc2626",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
