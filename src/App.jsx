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
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("新門司製造部");
  const [purpose, setPurpose] = useState("");
  const [room, setRoom] = useState("1階食堂");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [list, setList] = useState([]);

  const START_HOUR = 8;
  const END_HOUR = 18;
  const START_MIN = START_HOUR * 60;
  const END_MIN = END_HOUR * 60;
  const TOTAL_MIN = END_MIN - START_MIN;

  const times = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    ["00", "30"].forEach((m) => {
      if (h === END_HOUR && m === "30") return;
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

  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  };

  useEffect(() => {
    const q = query(collection(db, "reservations"), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setList(data.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    });
    return () => unsub();
  }, [date]);

  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const isOverlapping = () =>
    list.some(r => r.room === room && !(toMin(end) <= toMin(r.startTime) || toMin(start) >= toMin(r.endTime)));

  const addReservation = async () => {
    if (!name || !purpose) return alert("未入力の項目があります");
    if (toMin(start) >= toMin(end)) return alert("時間が正しくありません");
    if (isOverlapping()) return alert("同じ時間帯に既に予約があります");
    await addDoc(collection(db, "reservations"), { date, name, department, purpose, room, startTime: start, endTime: end });
    setName(""); setPurpose("");
  };

  const removeReservation = async (id) => {
    if (!window.confirm("この予約を削除してもよろしいですか？")) return;
    await deleteDoc(doc(db, "reservations", id));
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1580, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={headerSection}>
          <h1 style={titleStyle}>会議室予約システム</h1>
          <div style={legendStyle}>
            {Object.entries(deptColors).map(([dept, color]) => (
              <div key={dept} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, background: color, borderRadius: 3 }}></div>
                <span style={{ fontSize: 13, fontWeight: "bold", color: "#4a5568" }}>{dept}</span>
              </div>
            ))}
          </div>
          <div style={dateNavStyle}>
            <button onClick={() => changeDate(-1)} style={navBtnStyle}>◀ 前日</button>
            <span style={dateHeaderStyle}>📅 {date.replace(/-/g, "/")}</span>
            <button onClick={() => changeDate(1)} style={navBtnStyle}>翌日 ▶</button>
          </div>
        </div>

        <div style={mainLayout}>
          {/* 左：入力フォーム */}
          <div style={leftStyle}>
            <h2 style={formTitleStyle}>新規予約</h2>
            <FormField label="予約者名"><input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} placeholder="氏名" /></FormField>
            <FormField label="部署">
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="目的"><input value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle} placeholder="例：課内MTG" /></FormField>
            <FormField label="会議室">
              <select value={room} onChange={(e) => setRoom(e.target.value)} style={fieldStyle}>
                {rooms.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            <div style={{ display: "flex", gap: 15 }}>
              <FormField label="開始"><select value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle}>{times.map((t) => <option key={t}>{t}</option>)}</select></FormField>
              <FormField label="終了"><select value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle}>{times.concat("18:30").map((t) => <option key={t}>{t}</option>)}</select></FormField>
            </div>
            <button onClick={addReservation} style={buttonStyle}>予約を確定する</button>
          </div>

          {/* 右：コンテンツ表示 */}
          <div style={rightStyle}>
            {/* タイムライン */}
            <div style={timelineCard}>
              <div style={timeHeaderRow}>
                <div style={{ width: 130 }}></div>
                <div style={timeLabelsContainer}>
                  {times.filter((_, i) => i % 2 === 0).map((t) => (
                    <div key={t} style={{ ...timeLabelCell, width: `${(60 / TOTAL_MIN) * 100}%` }}>{t}</div>
                  ))}
                </div>
              </div>
              {rooms.map((roomName) => (
                <div key={roomName} style={roomRow}>
                  <div style={roomLabel}>{roomName}</div>
                  <div style={timelineTrack}>
                    {times.map((t) => (<div key={t} style={{ ...gridLine, left: `${((toMin(t) - START_MIN) / TOTAL_MIN) * 100}%` }} />))}
                    {list.filter((r) => r.room === roomName).map((r) => (
                      <div key={r.id} style={{ ...barStyle, left: `${((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100}%`, width: `${((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100}%`, background: deptColors[r.department] }}>
                        <span style={barTextStyle}><strong>{r.name}</strong>:{r.purpose}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 部屋別の詳細リスト（横並び） */}
            <div style={listGridArea}>
              {rooms.map(roomName => (
                <div key={roomName} style={roomListCard}>
                  <h3 style={roomListTitle}>{roomName}</h3>
                  <div style={scrollArea}>
                    {list.filter(r => r.room === roomName).map(r => (
                      <div key={r.id} style={compactItem}>
                        <div style={{flex:1}}>
                          <div style={itemTime}>{r.startTime}-{r.endTime}</div>
                          <div style={itemName}><strong>{r.name}</strong></div>
                        </div>
                        <button onClick={() => removeReservation(r.id)} style={delBtn}>削除</button>
                      </div>
                    ))}
                    {list.filter(r => r.room === roomName).length === 0 && <div style={noData}>予約なし</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* スタイル */
const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 15 }}><label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 5, color: "#4a5568" }}>{label}</label>{children}</div>
);

const pageStyle = { background: "#f1f5f9", height: "100vh", padding: "20px", fontFamily: "sans-serif", overflow: "hidden" };
const headerSection = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15, background: "#fff", padding: "12px 25px", borderRadius: "15px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const titleStyle = { fontSize: 24, fontWeight: "900", margin: 0, color: "#1e293b" };
const legendStyle = { display: "flex", gap: 20 };
const dateNavStyle = { display: "flex", alignItems: "center", gap: 15 };
const dateHeaderStyle = { fontSize: 20, fontWeight: "bold", color: "#1e293b" };
const navBtnStyle = { padding: "8px 16px", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: "bold", fontSize: "13px" };

const mainLayout = { display: "flex", gap: 20, height: "calc(100vh - 100px)" };
const leftStyle = { width: 320, background: "#fff", padding: "25px", borderRadius: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", height: "fit-content" };
const formTitleStyle = { fontSize: 18, marginBottom: 20, borderBottom: "2px solid #f1f5f9", paddingBottom: 10, fontWeight: "bold" };
const fieldStyle = { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px" };
const buttonStyle = { width: "100%", padding: "15px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", marginTop: "10px", boxShadow: "0 4px 12px rgba(37,99,235,0.2)" };

const rightStyle = { flex: 1, display: "flex", flexDirection: "column", gap: 20, height: "100%" };
const timelineCard = { background: "#fff", padding: "25px", borderRadius: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" };
const timeHeaderRow = { display: "flex", marginBottom: 15 };
const timeLabelsContainer = { display: "flex", flex: 1, position: "relative" };
const timeLabelCell = { fontSize: 12, color: "#64748b", fontWeight: "bold" };
const roomRow = { display: "flex", alignItems: "center", marginBottom: 15 };
const roomLabel = { width: 130, fontSize: 15, fontWeight: "bold", color: "#334155" };
const timelineTrack = { position: "relative", flex: 1, height: 45, background: "#f8fafc", borderRadius: "10px", border: "1px solid #f1f5f9", overflow: "hidden" };
const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "#f1f5f9" };
const barStyle = { position: "absolute", top: 6, bottom: 6, borderRadius: "6px", color: "#fff", display: "flex", alignItems: "center", padding: "0 12px", fontSize: "12px", zIndex: 2, boxShadow: "0 2px 5px rgba(0,0,0,0.1)" };
const barTextStyle = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const listGridArea = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, flex: 1, overflow: "hidden", paddingBottom: "10px" };
const roomListCard = { background: "#fff", borderRadius: "15px", padding: "15px", display: "flex", flexDirection: "column", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" };
const roomListTitle = { fontSize: 16, fontWeight: "bold", color: "#1e293b", marginBottom: 12, borderLeft: "4px solid #1e293b", paddingLeft: 10 };
const scrollArea = { flex: 1, overflowY: "auto" };
const compactItem = { display: "flex", alignItems: "center", background: "#f8fafc", padding: "10px", borderRadius: "8px", marginBottom: 8, border: "1px solid #f1f5f9" };
const itemTime = { fontSize: "11px", color: "#64748b", fontWeight: "bold" };
const itemName = { fontSize: "14px", color: "#1e293b" };
const delBtn = { marginLeft: 10, background: "#fee2e2", color: "#ef4444", border: "none", padding: "4px 8px", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" };
const noData = { textAlign: "center", fontSize: "12px", color: "#94a3b8", marginTop: "10px" };
