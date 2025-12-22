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

  useEffect(() => {
    const q = query(collection(db, "reservations"), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // 時間順にソートしてセット
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
            <h2 style={{ fontSize: 18, marginBottom: 20, borderBottom: "2px solid #eee", paddingBottom: 10 }}>新規予約</h2>
            <FormField label="日付">
              <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </FormField>
            <FormField label="名前">
              <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} placeholder="氏名を入力" />
            </FormField>
            <FormField label="所属部署">
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="使用目的・参加者数">
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle} placeholder="例：課内会議（5名）" />
            </FormField>
            <FormField label="会議室を選択">
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
            <button onClick={addReservation} style={buttonStyle}>この内容で予約する</button>
          </div>

          {/* 右側：タイムラインと詳細リスト */}
          <div style={rightStyle}>
            <div style={dateHeaderStyle}>📅 {date.replace(/-/g, "/")} の予約状況</div>
            
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
                            style={{ ...barStyle, left: `${left}%`, width: `${width}%`, background: deptColors[r.department] }}
                          >
                            <span style={barTextStyle}><strong>{r.name}</strong>: {r.purpose}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* 部屋ごとの予約詳細リスト */}
            <div style={{ marginTop: 40 }}>
              <h2 style={{ fontSize: 20, marginBottom: 20 }}>予約詳細（部屋別）</h2>
              {rooms.map(roomName => (
                <div key={roomName} style={{ marginBottom: 25 }}>
                  <h3 style={roomListHeader}>{roomName}</h3>
                  {list.filter(r => r.room === roomName).length > 0 ? (
                    list.filter(r => r.room === roomName).map(r => (
                      <div key={r.id} style={listItemStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                          <span style={timeBadge}>{r.startTime} ～ {r.endTime}</span>
                          <span style={{ ...deptBadge, background: deptColors[r.department] }}>{r.department}</span>
                          <span style={{ fontSize: 16 }}><strong>{r.name}</strong>：{r.purpose}</span>
                        </div>
                        <button onClick={() => removeReservation(r.id)} style={deleteBtnStyle}>削除</button>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: "#999", fontSize: 14, paddingLeft: 10 }}>この部屋の予約はありません</p>
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

/* ===== 共通コンポーネント ===== */
const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 18, flex: 1 }}>
    <label style={{ fontSize: 14, fontWeight: "bold", display: "block", marginBottom: 6, color: "#444" }}>{label}</label>
    {children}
  </div>
);

/* ===== Styles ===== */
const pageStyle = { background: "#f8f9fa", minHeight: "100vh", padding: "40px 20px", fontFamily: "'Helvetica Neue', Arial, sans-serif" };
const titleStyle = { textAlign: "center", marginBottom: 10, fontSize: 32, fontWeight: "800", color: "#1a202c" };
const legendStyle = { display: "flex", justifyContent: "center", gap: 20, marginBottom: 30, background: "#fff", padding: "10px", borderRadius: "30px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };
const layoutStyle = { display: "flex", gap: 30, alignItems: "flex-start" };

const leftStyle = { flex: "0 0 350px", background: "#fff", padding: "30px", borderRadius: "15px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", position: "sticky", top: 20 };
const rightStyle = { flex: 1 };

const fieldStyle = { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e0", fontSize: "15px", outline: "none" };
const buttonStyle = { width: "100%", padding: "15px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "16px", marginTop: "10px", transition: "0.2s" };

const dateHeaderStyle = { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "#2d3748" };
const timelineWrapper = { background: "#fff", padding: "30px 20px", borderRadius: "15px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" };

const timeHeaderRow = { display: "flex", marginBottom: 15 };
const timeLabelsContainer = { display: "flex", flex: 1, position: "relative" };
const timeLabelCell = { fontSize: 12, color: "#718096", fontWeight: "600" };

const roomRow = { display: "flex", alignItems: "center", marginBottom: 20 };
const roomLabel = { width: 140, fontSize: 15, fontWeight: "bold", color: "#4a5568" };
const timelineTrack = { position: "relative", flex: 1, height: 50, background: "#f7fafc", borderRadius: "8px", border: "1px solid #edf2f7", overflow: "hidden" };
const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "#e2e8f0" };

const barStyle = { position: "absolute", top: 6, bottom: 6, borderRadius: "6px", color: "#fff", display: "flex", alignItems: "center", padding: "0 12px", fontSize: "12px", zIndex: 2, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" };
const barTextStyle = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const roomListHeader = { fontSize: 18, borderLeft: "5px solid #2d3748", paddingLeft: 12, marginBottom: 15, color: "#2d3748" };
const listItemStyle = { background: "#fff", padding: "15px 20px", borderRadius: "10px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.03)" };
const timeBadge = { background: "#edf2f7", padding: "5px 10px", borderRadius: "5px", fontSize: "14px", fontWeight: "bold", color: "#2d3748", minWidth: "110px", textAlign: "center" };
const deptBadge = { color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" };
const deleteBtnStyle = { background: "#fee2e2", color: "#dc2626", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" };
