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

  /* ===== 時刻 ===== */
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
    if (!name || !purpose) {
      alert("未入力の項目があります");
      return;
    }
    if (start >= end) {
      alert("時間が正しくありません");
      return;
    }
    if (isOverlapping()) {
      alert("同じ時間帯に既に予約があります");
      return;
    }

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

  /* ===== タイムライン用 ===== */
  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const START = 8 * 60;
  const END = 18 * 60;
  const TOTAL = END - START;

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>会議室予約</h1>

      <div style={layoutStyle}>
        {/* ===== 左：入力 ===== */}
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

        {/* ===== 右：予約一覧＋タイムライン ===== */}
        <div style={rightStyle}>
          <div style={dateHeaderStyle}>
            📅 {new Date(date).toLocaleDateString("ja-JP")}
          </div>

          {rooms.map((roomName) => (
            <div key={roomName} style={roomBlock}>
              <h2 style={roomTitleStyle}>{roomName}</h2>

              <div style={timelineCardStyle}>
                {list
                  .filter((r) => r.room === roomName)
                  .map((r) => (
                    <div key={r.id} style={rowStyle}>
                      <div>
                        <strong>
                          {r.startTime}〜{r.endTime}
                        </strong>{" "}
                        ／ {r.name}
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

          {/* ===== 追加：部屋別タイムライン ===== */}
          <div style={timelineWrapper}>
            <h2 style={{ marginBottom: 12 }}>🕒 タイムライン</h2>

            <div style={timeHeader}>
              {times.map((t) => (
                <div key={t} style={timeCell}>
                  {t}
                </div>
              ))}
            </div>

            {rooms.map((roomName) => (
              <div key={roomName} style={timelineRow}>
                <div style={roomLabel}>{roomName}</div>
                <div style={timelineLine}>
                  {list
                    .filter((r) => r.room === roomName)
                    .map((r) => {
                      const left =
                        ((toMin(r.startTime) - START) / TOTAL) * 100;
                      const width =
                        ((toMin(r.endTime) - toMin(r.startTime)) /
                          TOTAL) *
                        100;

                      return (
                        <div
                          key={r.id}
                          style={{
                            ...barStyle,
                            left: `${left}%`,
                            width: `${width}%`,
                          }}
                        >
                          {r.purpose}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== 共通 ===== */
const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 13, marginBottom: 4, display: "block" }}>
      {label}
    </label>
    {children}
  </div>
);

/* ===== style ===== */
const pageStyle = { background: "#f5f6f8", minHeight: "100vh", padding: 24 };
const titleStyle = { textAlign: "center", fontSize: 24, marginBottom: 20 };
const layoutStyle = { display: "flex", gap: 24, alignItems: "flex-start" };
const leftStyle = {
  flex: "0 0 520px",
  background: "#fff",
  borderRadius: 12,
  padding: 24,
};
const rightStyle = { flex: 1 };
const dateHeaderStyle = { fontSize: 16, marginBottom: 12 };
const fieldStyle = { width: "100%", height: 42, borderRadius: 8 };
const buttonStyle = {
  width: "100%",
  height: 46,
  background: "#16a34a",
  color: "#fff",
  borderRadius: 8,
};
const roomBlock = { marginBottom: 20 };
const roomTitleStyle = { fontSize: 16 };
const timelineCardStyle = { background: "#fff", borderRadius: 10 };
const rowStyle = { display: "flex", justifyContent: "space-between", padding: 10 };
const purposeStyle = { fontSize: 12 };
const deleteStyle = { background: "none", border: "none", color: "#dc2626" };
const emptyStyle = { padding: 12, color: "#999" };

/* ===== タイムライン ===== */
const timelineWrapper = {
  marginTop: 40,
  background: "#fff",
  padding: 16,
  borderRadius: 12,
};

const timeHeader = { display: "flex", marginLeft: 120 };
const timeCell = {
  flex: 1,
  fontSize: 10,
  textAlign: "center",
  color: "#666",
};

const timelineRow = { display: "flex", marginBottom: 14 };
const roomLabel = { width: 120, fontSize: 13 };
const timelineLine = {
  position: "relative",
  flex: 1,
  height: 32,
  background: "#f1f5f9",
  borderRadius: 6,
};

const barStyle = {
  position: "absolute",
  top: 4,
  height: 24,
  background: "#60a5fa",
  color: "#fff",
  fontSize: 11,
  padding: "0 6px",
  borderRadius: 6,
  whiteSpace: "nowrap",
  overflow: "hidden",
};
