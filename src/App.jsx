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

  const departments = [
    "新門司製造部",
    "新門司セラミック",
    "総務部",
    "役員",
    "その他",
  ];

  /* ===== Firestore ===== */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reservations"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.date === date);
      setList(data);
    });
    return () => unsub();
  }, [date]);

  /* ===== 重複チェック ===== */
  const isOverlapping = () =>
    list.some(
      (r) =>
        r.room === room &&
        !(end <= r.startTime || start >= r.endTime)
    );

  const addReservation = async () => {
    if (!name) return alert("名前を入力してください");
    if (!purpose) return alert("使用目的を入力してください");
    if (start >= end) return alert("時間が正しくありません");
    if (isOverlapping())
      return alert("同じ時間帯に既に予約があります");

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

      {/* ===== 入力フォーム ===== */}
      <div style={formContainer}>
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

      {/* ===== 一覧 ===== */}
      <div style={listContainer}>
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
  );
}

/* ===== 共通 ===== */
const FormField = ({ label, children }) => (
  <div style={fieldGroup}>
    <label style={labelText}>{label}</label>
    {children}
  </div>
);

/* ===== style ===== */
const pageStyle = {
  minHeight: "100vh",
  background: "#f5f6f8",
  padding: "40px 20px",
  fontFamily: "system-ui, sans-serif",
};

const titleStyle = {
  textAlign: "center",
  fontSize: 26,
  fontWeight: 600,
  marginBottom: 20,
};

const formContainer = {
  maxWidth: 560,
  margin: "0 auto 40px",
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

const fieldGroup = { marginBottom: 12 };

const labelText = {
  fontSize: 14,
  marginBottom: 4,
  display: "block",
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  height: 42,
  fontSize: 15,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid #ccc",
};

const buttonStyle = {
  marginTop: 12,
  width: "100%",
  height: 46,
  borderRadius: 8,
  border: "none",
  background: "#16a34a",
  color: "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};

const listContainer = {
  maxWidth: 720,
  margin: "0 auto",
};

const roomBlock = { marginBottom: 28 };

const roomTitleStyle = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 8,
};

const timelineCardStyle = {
  background: "#fff",
  borderRadius: 10,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  borderBottom: "1px solid #eee",
  fontSize: 15,
};

const purposeStyle = {
  fontSize: 13,
  color: "#555",
};

const deleteStyle = {
  border: "none",
  background: "none",
  color: "#dc2626",
  cursor: "pointer",
};

const emptyStyle = {
  padding: 14,
  fontSize: 14,
  color: "#999",
};
