import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  doc,
  query,
  where,
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

  /* ===== 設定：8:00〜18:00 (30分刻み) ===== */
  const START_HOUR = 8;
  const END_HOUR = 18;
  const START_MIN = START_HOUR * 60;
  const END_MIN = END_HOUR * 60;
  const TOTAL_MIN = END_MIN - START_MIN;

  const times = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    ["00", "30"].forEach((m) => {
      if (h === END_HOUR && m === "30") return; // 18:30以降は除外
      times.push(`${String(h).padStart(2, "0")}:${m}`);
    });
  }

  const rooms = ["1階食堂", "2階会議室①", "2階会議室②", "3階応接室"];
  const departments = ["新門司製造部", "新門司セラミック", "総務部", "役員", "その他"];
  const deptColors = {
    新門司製造部: "#3b82f6",
    新門司セラミック: "#10b981",
    総務部: "#f59e0b",
    役員: "#8b5cf6",
    その他: "#6b7280",
  };

  /* ===== Firestore: 日付が変わるたびにその日の分だけをリアルタイム購読 ===== */
  useEffect(() => {
    const q = query(collection(db, "reservations"), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setList(data);
    });
    return () => unsub();
  }, [date]);

  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const isOverlapping = () =>
    list.some(
      (r) =>
        r.room === room &&
        !(toMin(end) <= toMin(r.startTime) || toMin(start) >= toMin(r.endTime))
    );

  const addReservation = async () => {
    if (!name || !purpose) return alert("未入力の項目があります");
    if (toMin(start) >= toMin(end)) return alert("時間が正しくありません");
    if (isOverlapping()) return alert("同じ時間帯に既に予約があります");

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
    if (!window.confirm("この予約を削除してもよろしいですか？")) return;
    await deleteDoc(doc(db, "reservations", id));
  };

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>会議室予約システム</h1>

      <div style={layoutStyle}>
        {/* 左側：入力フォーム */}
        <div style={leftStyle}>
          <FormField label="日付">
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          </FormField>
          <FormField label="名前">
            <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
          </FormField>
          <FormField label="所属">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField label="使用目的・参加者">
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle} placeholder="例：定例MTG（3名）" />
          </FormField>
          <FormField label="部屋">
            <select value={room} onChange={(e) => setRoom(e.target.value)} style={fieldStyle}>
              {rooms.map((r) => <option key={r}>{r}</option>)}
            </select>
          </FormField>
          <div style={{ display: "flex", gap: 10 }}>
            <FormField label="開始">
              <select value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle}>
                {times.map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="終了">
              <select value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle}>
                {times.concat("18:30").map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <button onClick={addReservation} style={buttonStyle}>予約する</button>
        </div>

        {/* 右側：タイムライン表示 */}
        <div style={rightStyle}>
          <div style={dateHeaderStyle}>📅 {date} の予約状況</div>
          
          <div style={timelineWrapper}>
            {/* 時間軸の目盛り */}
            <div style={timeHeaderRow}>
              <div style={{ width: 100 }}></div> {/* 部屋名ラベル分の余白 */}
              <div style={timeLabelsContainer}>
                {times.filter((_, i) => i % 2 === 0).map((t) => (
                  <div key={t} style={{ ...timeLabelCell, width: `${(60 / TOTAL_MIN) * 100}%` }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* 各部屋のライン */}
            {rooms.map((roomName) => (
              <div key={roomName} style={roomRow}>
                <div style={roomLabel}>{roomName}</div>
                <div style={timelineTrack}>
                  {/* 背景の30分ごとの縦線グリッド */}
                  {times.map((t) => (
                    <div key={t} style={{ ...gridLine, left: `${((toMin(t) - START_MIN) / TOTAL_MIN) * 100}%` }} />
                  ))}
                  
                  {/* 予約バー */}
                  {list
                    .filter((r) => r.room === roomName)
                    .map((r) => {
                      const left = ((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100;
                      const width = ((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100;
                      return (
                        <div
                          key={r.id}
                          title={`${r.startTime}-${r.endTime} ${r.name}: ${r.purpose}`}
                          style={{
                            ...barStyle,
                            left: `${left}%`,
                            width: `${width}%`,
                            background: deptColors[r.department],
                          }}
                        >
                          <span style={barTextStyle}>{r.purpose}</span>
                          <button onClick={() => removeReservation(r.id)} style={barDeleteBtn}>×</button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {/* 簡易リスト表示（削除用） */}
          <div style={{ marginTop: 24 }}>
            <h3>予約詳細リスト</h3>
            {list.map((r) => (
              <div key={r.id} style={listItemStyle}>
                <span>{r.startTime}～{r.endTime} | <strong>{r.room}</strong> | {r.name} ({r.purpose})</span>
                <button onClick={() => removeReservation(r.id)} style={deleteLinkStyle}>削除</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== 共通コンポーネント ===== */
const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 12, flex: 1 }}>
    <label style={{ fontSize: 12, fontWeight: "bold", display: "block", marginBottom: 4 }}>{label}</label>
    {children}
  </div>
);

/* ===== Styles ===== */
const pageStyle = { background: "#f0f2f5", minHeight: "100vh", padding: 20, fontFamily: "sans-serif" };
const titleStyle = { textAlign: "center", marginBottom: 20, color: "#333" };
const layoutStyle = { display: "flex", gap: 20, maxWidth: 1200, margin: "0 auto" };
const leftStyle = { flex: "0 0 300px", background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", height: "fit-content" };
const rightStyle = { flex: 1 };
const fieldStyle = { width: "100%", padding: "8px", borderRadius: 4, border: "1px solid #ddd", boxSizing: "border-box" };
const buttonStyle = { width: "100%", padding: "12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const dateHeaderStyle = { fontSize: 18, fontWeight: "bold", marginBottom: 15 };

const timelineWrapper = { background: "#fff", padding: "20px 10px", borderRadius: 10, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", overflowX: "auto" };
const timeHeaderRow = { display: "flex", marginBottom: 10 };
const timeLabelsContainer = { display: "flex", flex: 1, position: "relative", borderBottom: "1px solid #eee" };
const timeLabelCell = { fontSize: 11, color: "#666", textAlign: "left" };

const roomRow = { display: "flex", alignItems: "center", marginBottom: 15 };
const roomLabel = { width: 100, fontSize: 13, fontWeight: "bold", color: "#444" };
const timelineTrack = { position: "relative", flex: 1, height: 40, background: "#f9fafb", borderRadius: 4, border: "1px solid #eee" };
const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "#eee" };

const barStyle = {
  position: "absolute",
  top: 4,
  bottom: 4,
  borderRadius: 4,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 8px",
  fontSize: 11,
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  zIndex: 2,
  overflow: "hidden"
};
const barTextStyle = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 };
const barDeleteBtn = { background: "rgba(0,0,0,0.2)", border: "none", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, cursor: "pointer", marginLeft: 4 };

const listItemStyle = { background: "#fff", padding: "10px 15px", borderRadius: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 };
const deleteLinkStyle = { color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12 };
