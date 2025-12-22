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
      <div style={{ maxWidth: 1550, margin: "0 auto" }}>
        {/* ヘッダーエリア（一行に集約） */}
        <div style={headerRow}>
          <h1 style={titleStyle}>会議室予約</h1>
          <div style={legendStyle}>
            {Object.entries(deptColors).map(([dept, color]) => (
              <div key={dept} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, background: color, borderRadius: 2 }}></div>
                <span style={{ fontSize: 12 }}>{dept}</span>
              </div>
            ))}
          </div>
          <div style={dateNavStyle}>
            <button onClick={() => changeDate(-1)} style={navBtnStyle}>◀</button>
            <span style={dateHeaderStyle}>📅 {date.replace(/-/g, "/")}</span>
            <button onClick={() => changeDate(1)} style={navBtnStyle}>▶</button>
          </div>
        </div>

        <div style={mainLayout}>
          {/* 左：フォーム（幅を詰め、高さを1画面内に） */}
          <div style={leftFormStyle}>
            <FormField label="予約者名"><input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></FormField>
            <FormField label="所属部署">
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="目的"><input value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle} /></FormField>
            <FormField label="会議室">
              <select value={room} onChange={(e) => setRoom(e.target.value)} style={fieldStyle}>
                {rooms.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            <div style={{ display: "flex", gap: 10 }}>
              <FormField label="開始"><select value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle}>{times.map((t) => <option key={t}>{t}</option>)}</select></FormField>
              <FormField label="終了"><select value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle}>{times.concat("18:30").map((t) => <option key={t}>{t}</option>)}</select></FormField>
            </div>
            <button onClick={addReservation} style={buttonStyle}>予約確定</button>
          </div>

          {/* 右上：タイムライン */}
          <div style={rightDisplayArea}>
            <div style={timelineContainer}>
              <div style={timeHeaderRow}>
                <div style={{ width: 100 }}></div>
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

            {/* 右下：部屋別リスト（横並びで高さを節約） */}
            <div style={listGrid}>
              {rooms.map(roomName => (
                <div key={roomName} style={roomListSection}>
                  <div style={roomListTitle}>{roomName}</div>
                  <div style={roomListScroll}>
                    {list.filter(r => r.room === roomName).map(r => (
                      <div key={r.id} style={compactListItem}>
                        <span style={{fontWeight:'bold', fontSize:12}}>{r.startTime}-{r.endTime}</span>
                        <span style={{fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}> {r.name}</span>
                        <button onClick={() => removeReservation(r.id)} style={smallDelBtn}>×</button>
                      </div>
                    ))}
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

const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 10 }}><label style={{ fontSize: 12, fontWeight: "bold", display: "block", marginBottom: 3 }}>{label}</label>{children}</div>
);

/* Styles (1画面に収めるための凝縮設定) */
const pageStyle = { background: "#f0f2f5", height: "100vh", padding: "10px 20px", fontFamily: "sans-serif", overflow: "hidden" };
const headerRow = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, background: "#fff", padding: "5px 20px", borderRadius: "10px" };
const titleStyle = { fontSize: 20, fontWeight: "900", margin: 0 };
const legendStyle = { display: "flex", gap: 15 };
const dateNavStyle = { display: "flex", alignItems: "center", gap: 10 };
const dateHeaderStyle = { fontSize: 18, fontWeight: "bold" };
const navBtnStyle = { padding: "4px 10px", cursor: "pointer", borderRadius: "4px", border: "1px solid #ccc" };

const mainLayout = { display: "flex", gap: 15, height: "calc(100vh - 70px)" };
const leftFormStyle = { width: 260, background: "#fff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", height: "fit-content" };
const fieldStyle = { width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "14px" };
const buttonStyle = { width: "100%", padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", marginTop: "10px", cursor: "pointer" };

const rightDisplayArea = { flex: 1, display: "flex", flexDirection: "column", gap: 10, height: "100%" };
const timelineContainer = { background: "#fff", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const timeHeaderRow = { display: "flex", marginBottom: 5 };
const timeLabelsContainer = { display: "flex", flex: 1, position: "relative" };
const timeLabelCell = { fontSize: 11, color: "#718096" };
const roomRow = { display: "flex", alignItems: "center", marginBottom: 8 };
const roomLabel = { width: 100, fontSize: 13, fontWeight: "bold" };
const timelineTrack = { position: "relative", flex: 1, height: 36, background: "#f8fafc", borderRadius: "6px", border: "1px solid #eee", overflow: "hidden" };
const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "#eee" };
const barStyle = { position: "absolute", top: 4, bottom: 4, borderRadius: "4px", color: "#fff", display: "flex", alignItems: "center", padding: "0 8px", fontSize: "11px", zIndex: 2 };
const barTextStyle = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const listGrid = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flex: 1, overflow: "hidden" };
const roomListSection = { background: "#fff", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", border: "1px solid #e0e0e0" };
const roomListTitle = { fontSize: 14, fontWeight: "bold", borderBottom: "2px solid #f0f0f0", marginBottom: 8, paddingBottom: 4 };
const roomListScroll = { flex: 1, overflowY: "auto" };
const compactListItem = { display: "flex", alignItems: "center", background: "#f9f9f9", padding: "4px 8px", borderRadius: "4px", marginBottom: 4, gap: 5 };
const smallDelBtn = { background: "none", border: "none", color: "#cc0000", cursor: "pointer", fontWeight: "bold", fontSize: "14px" };
