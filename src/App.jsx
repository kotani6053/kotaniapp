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

  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("新門司製造部");
  const [purpose, setPurpose] = useState("");
  const [room, setRoom] = useState("1階食堂");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [list, setList] = useState([]);

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

  const departments = [
    "新門司製造部",
    "新門司セラミック",
    "総務部",
    "役員",
    "その他",
  ];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reservations"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.date === date);
      setList(data);
    });
    return () => unsub();
  }, [date]);

  const isOverlapping = () =>
    list.some(
      (r) =>
        r.room === room &&
        !(end <= r.startTime || start >= r.endTime)
    );

  const addReservation = async () => {
    if (!name || !purpose) return alert("未入力項目があります");
    if (start >= end) return alert("時間が正しくありません");
    if (isOverlapping()) return alert("時間が重複しています");

    await addDoc(collection(db, "reservations"), {
      date,
      name,
      department,
      purpose,
      room,
      startTime: start,
      endTime: end,
    });

    setName("");
    setPurpose("");
  };

  const removeReservation = async (id) => {
    if (!window.confirm("この予約を削除してもよろしいですか？"))
      return;
    await deleteDoc(doc(db, "reservations", id));
  };

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>会議室予約</h1>

      {/* ===== 左右レイアウト ===== */}
      <div style={layoutStyle}>
        {/* 左：入力 */}
        <div style={leftStyle}>
          <FormField label="日付">
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              style={fieldStyle}
            />
          </FormField>

          <FormField label="名前">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={fieldStyle}
            />
          </FormField>

          <FormField label="所属">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={fieldStyle}
            >
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </FormField>

          <FormField label="使用目的">
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              style={fieldStyle}
            />
          </FormField>

          <FormField label="部屋">
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              style={fieldStyle}
            >
              {rooms.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </FormField>

          <FormField label="開始時間">
            <select
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={fieldStyle}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </FormField>

          <FormField label="終了時間">
            <select
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={fieldStyle}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </FormField>

          <button onClick={addReservation} style={buttonStyle}>
            予約する
          </button>
        </div>

        {/* 右：予約一覧 */}
        <div style={rightStyle}>
          {rooms.map((roomName) => (
            <div key={roomName} style={roomBlock}>
              <h2 style={roomTitleStyle}>{roomName}</h2>

              <div style={timelineCardStyle}>
                {list
                  .filter((r) => r.room === roomName)
                  .sort((a, b) =>
                    a.startTime.localeCompare(b.startTime)
                  )
                  .map((r) => (
                    <div key={r.id} style={rowStyle}>
                      <div>
                        <strong>
                          {r.startTime}〜{r.endTime}
                        </strong>{" "}
                        ／ {r.name}（{r.department}）
                        <div style={purposeStyle}>
                          使用目的：{r.purpose}
                        </div>
                      </div>
                      <button
                        onClick={() => removeReservation(r.id)}
                        style={deleteStyle}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                {list.filter((r) => r.room === roomName).length === 0 && (
                  <div style={emptyStyle}>予約なし</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== 共通 ===== */
const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 13, marginBottom: 4, display: "block" }}>
      {label}
    </label>
    {children}
  </div>
);

/* ===== style ===== */
const pageStyle = {
  background: "#f5f6f8",
  minHeight: "100vh",
  padding: 24,
  fontFamily: "system-ui, sans-serif",
};

const titleStyle = {
  textAlign: "center",
  fontSize: 24,
  marginBottom: 20,
};

const layoutStyle = {
  display: "flex",
  gap: 24,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const leftStyle = {
  width: 420,
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

const rightStyle = {
  flex: 1,
  minWidth: 320,
};

const fieldStyle = {
  width: "100%",
  height: 40,
  borderRadius: 8,
  border: "1px solid #ccc",
  padding: "0 10px",
};

const buttonStyle = {
  width: "100%",
  height: 44,
  marginTop: 12,
  borderRadius: 8,
  background: "#16a34a",
  color: "#fff",
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
};

const roomBlock = { marginBottom: 20 };

const roomTitleStyle = { fontSize: 16, marginBottom: 6 };

const timelineCardStyle = {
  background: "#fff",
  borderRadius: 10,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  fontSize: 14,
};

const purposeStyle = { fontSize: 12, color: "#555" };

const deleteStyle = {
  background: "none",
  border: "none",
  color: "#dc2626",
  cursor: "pointer",
};

const emptyStyle = {
  padding: 12,
  fontSize: 13,
  color: "#999",
};
