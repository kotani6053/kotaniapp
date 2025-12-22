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

  /* 日付操作関数 */
  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  };

  useEffect(() => {
    const q = query(collection(db, "reservations"), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const sortedData = data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setList(sortedData);
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
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={titleStyle}>会議室予約システム</h1>

        {/* 部署カラー凡例 */}
        <div style={legendStyle}>
          {Object.entries(deptColors).map(([dept, color]) => (
            <div key={dept} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 14, height: 14, background: color, borderRadius: 3 }}></div>
              <span style={{ fontSize: 13, fontWeight: "bold" }}>{dept}</span>
            </div>
          ))}
        </div>

        <div style={layoutStyle}>
          {/* 左側：入力フォーム */}
          <div style={leftStyle}>
            <h2 style={formTitleStyle}>新規予約</h2>
            <FormField label="日付">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </FormField>
            <FormField label="予約者名">
              <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} placeholder="氏名" />
            </FormField>
            <FormField label="所属部署">
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="目的・参加人数">
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle} placeholder="例：定例MTG（5名）" />
            </FormField>
            <FormField label="会議室">
              <select value={room} onChange={(e) => setRoom(e.target.value)} style={fieldStyle}>
                {rooms.map((r) => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            <div style={{ display: "flex", gap: 15 }}>
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
            <button onClick={addReservation} style={buttonStyle}>予約を確定する</button>
          </div>

          {/* 右側：表示エリア */}
          <div style={rightStyle}>
            <div style={dateNavStyle}>
              <button onClick={() => changeDate(-1)} style={navBtnStyle}>◀ 前日</button>
              <span style={dateHeaderStyle}>📅 {date.replace(/-/g, "/")} の状況</span>
              <button onClick={() => changeDate(1)} style={navBtnStyle}>翌日 ▶</button>
            </div>
            
            <div style={timelineWrapper}>
              <div style={timeHeaderRow}>
                <div style={{ width: 140 }}></div>
                <div style={timeLabelsContainer}>
                  {times.filter((_, i) => i % 2 === 0).map((t) => (
                    <div key={t} style={{ ...timeLabelCell, width: `${(60 / TOTAL_MIN) * 100}%` }}>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {rooms.map((roomName) => (
                <div key={roomName} style={roomRow}>
                  <div style={roomLabel}>{roomName}</div>
                  <div style={timelineTrack}>
                    {times.map((t) => (
                      <div key={t} style={{ ...gridLine, left: `${((toMin(t) - START_MIN) / TOTAL_MIN) * 100}%` }} />
                    ))}
                    {list.filter((r) => r.room === roomName).map((r) => {
                        const left = ((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100;
                        const width = ((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100;
                        return (
                          <div
                            key={r.id}
                            title={`${r.startTime}〜${r.endTime} ${r.name}`}
                            style={{ ...barStyle, left: `${left}%`, width: `${width}%`, background: deptColors[r.department] }}
                          >
                            <span style={barTextStyle}><strong>{r.name}</strong>: {r.purpose}</span>
                            <button onClick={() => removeReservation(r.id)} style={miniDeleteBtn}>×</button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* 部屋ごとの詳細リスト */}
            <div style={{ marginTop: 40 }}>
              <h2 style={{ fontSize: 22, marginBottom: 20 }}>予約詳細（部屋別）</h2>
              {rooms.map(roomName => (
                <div key={roomName} style={{ marginBottom: 30 }}>
                  <h3 style={roomListHeader}>{roomName}</h3>
                  {list.filter(r => r.room === roomName).length > 0 ? (
                    list.filter(r => r.room === roomName).map(r => (
                      <div key={r.id} style={listItemStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                          <span style={timeBadge}>{r.startTime} ～ {r.endTime}</span>
                          <span style={{ ...deptBadge, background: deptColors[r.department] }}>{r.department}</span>
                          <span style={{ fontSize: 17 }}><strong>{r.name}</strong> ／ {r.purpose}</span>
                        </div>
                        <button onClick={() => removeReservation(r.id)} style={deleteBtnStyle}>削除</button>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: "#999", fontSize: 15, paddingLeft: 10 }}>この部屋の予約はありません</p>
                  )}
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
  <div style={{ marginBottom: 20, flex: 1 }}>
    <label style={{ fontSize: 14, fontWeight: "bold", display: "block", marginBottom: 8, color: "#444" }}>{label}</label>
    {children}
  </div>
);

/* Styles */
const pageStyle = { background: "#f1f3f6", minHeight: "100vh", padding: "40px 20px", fontFamily: "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif" };
const titleStyle = { textAlign: "center", marginBottom: 10, fontSize: 34, fontWeight: "900", color: "#1a202c" };
const legendStyle = { display: "flex", justifyContent: "center", gap: 25, marginBottom: 35, background: "#fff", padding: "12px 25px", borderRadius: "40px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", width: "fit-content", margin: "0 auto 35px" };
const layoutStyle = { display: "flex", gap: 40, alignItems: "flex-start" };

const leftStyle = { flex: "0 0 380px", background: "#fff", padding: "35px", borderRadius: "20px", boxShadow: "0 15px 35px rgba(0,0,0,0.08)", position: "sticky", top: 20 };
const formTitleStyle = { fontSize: 20, marginBottom: 25, borderBottom: "3px solid #f1f3f6", paddingBottom: 15, fontWeight: "bold" };
const rightStyle = { flex: 1 };

const fieldStyle = { width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "16px", outline: "none", transition: "0.2s border" };
const buttonStyle = { width: "100%", padding: "18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "18px", marginTop: "15px", boxShadow: "0 4px 12px rgba(37,99,235,0.2)" };

const dateNavStyle = { display: "flex", alignItems: "center", gap: 20, marginBottom: 25 };
const navBtnStyle = { background: "#fff", border: "1px solid #d1d5db", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", transition: "0.2s" };
const dateHeaderStyle = { fontSize: 26, fontWeight: "bold", color: "#2d3748" };

const timelineWrapper = { background: "#fff", padding: "40px 25px", borderRadius: "20px", boxShadow: "0 15px 35px rgba(0,0,0,0.08)" };
const timeHeaderRow = { display: "flex", marginBottom: 20 };
const timeLabelsContainer = { display: "flex", flex: 1, position: "relative" };
const timeLabelCell = { fontSize: 13, color: "#718096", fontWeight: "bold" };

const roomRow = { display: "flex", alignItems: "center", marginBottom: 25 };
const roomLabel = { width: 140, fontSize: 16, fontWeight: "bold", color: "#4a5568" };
const timelineTrack = { position: "relative", flex: 1, height: 60, background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden" };
const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "#e2e8f0" };

const barStyle = { position: "absolute", top: 8, bottom: 8, borderRadius: "8px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 15px", fontSize: "13px", zIndex: 2, boxShadow: "0 4px 6px rgba(0,0,0,0.15)", minWidth: "40px" };
const barTextStyle = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "10px" };
const miniDeleteBtn = { background: "rgba(0,0,0,0.25)", border: "none", color: "#fff", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "14px", flexShrink: 0 };

const roomListHeader = { fontSize: 20, borderLeft: "6px solid #2d3748", paddingLeft: 15, marginBottom: 20, color: "#2d3748", fontWeight: "bold" };
const listItemStyle = { background: "#fff", padding: "20px 25px", borderRadius: "12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.04)" };
const timeBadge = { background: "#2d3748", color: "#fff", padding: "6px 14px", borderRadius: "6px", fontSize: "15px", fontWeight: "bold", minWidth: "120px", textAlign: "center" };
const deptBadge = { color: "#fff", padding: "5px 10px", borderRadius: "5px", fontSize: "12px", fontWeight: "bold" };
const deleteBtnStyle = { background: "#fee2e2", color: "#dc2626", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", transition: "0.2s" };
