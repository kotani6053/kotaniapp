"use client";
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
  updateDoc, // 更新用にインポート
} from "firebase/firestore";

export default function App() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("新門司製造部");
  const [purpose, setPurpose] = useState("会議"); 
  const [clientName, setClientName] = useState(""); 
  const [guestCount, setGuestCount] = useState("1"); 
  const [room, setRoom] = useState("会議室");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [list, setList] = useState([]);

  // ★ 編集中のドキュメントIDを管理するステート
  const [editingId, setEditingId] = useState(null);

  const START_HOUR = 8;
  const END_HOUR = 18;
  const START_MIN = START_HOUR * 60;
  const END_MIN = END_HOUR * 60;
  const TOTAL_MIN = END_MIN - START_MIN;

  const rooms = ["会議室", "応接室", "空き1", "空き2"];
  const departments = ["新門司製造部", "新門司セラミック", "総務部", "役員", "その他"];
  const purposePresets = ["会議", "来客", "面談", "面接", "その他"];

  const deptColors = {
    新門司製造部: "#3b82f6",
    新門司セラミック: "#10b981",
    総務部: "#f59e0b",
    役員: "#8b5cf6",
    その他: "#6b7280",
  };

  const times = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    ["00", "30"].forEach((m) => {
      if (h === END_HOUR && m === "30") return;
      times.push(`${String(h).padStart(2, "0")}:${m}`);
    });
  }

  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
    cancelEdit(); // 日付を変えたら編集キャンセル
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
    list.some(r => 
      r.id !== editingId && // ★編集中の自分自身との重複は無視する
      r.room === room && 
      !(toMin(end) <= toMin(r.startTime) || toMin(start) >= toMin(r.endTime))
    );

  // ★ 編集ボタンを押した時の処理
  const startEdit = (r) => {
    setEditingId(r.id);
    setName(r.name);
    setDepartment(r.department);
    setPurpose(r.purpose);
    setClientName(r.clientName);
    setGuestCount(r.guestCount);
    setRoom(r.room);
    setStart(r.startTime);
    setEnd(r.endTime);
    // スムーズに上までスクロール
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ★ 編集キャンセル
  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setClientName("");
    setGuestCount("1");
  };

  const handleSave = async () => {
    if (!name || !purpose) return alert("未入力の項目があります");
    if (purpose === "来客" && !clientName) return alert("来客社名を入力してください");
    if (toMin(start) >= toMin(end)) return alert("終了時間は開始時間より後に設定してください");
    if (isOverlapping()) return alert(`⚠️既に他の予約が入っています。`);

    const reservationData = { 
      date, 
      name, 
      department, 
      purpose, 
      clientName: purpose === "来客" ? clientName : "",
      guestCount,
      room, 
      startTime: start, 
      endTime: end,
      updatedAt: new Date()
    };

    try {
      if (editingId) {
        // ★ 編集モードなら更新(updateDoc)
        await updateDoc(doc(db, "reservations", editingId), reservationData);
        alert("予約を更新しました");
      } else {
        // 新規作成
        await addDoc(collection(db, "reservations"), { ...reservationData, createdAt: new Date() });
      }
      cancelEdit();
    } catch (e) {
      alert("保存に失敗しました。");
    }
  };

  const removeReservation = async (id) => {
    if (!window.confirm("この予約を削除してもよろしいですか？")) return;
    await deleteDoc(doc(db, "reservations", id));
    if (editingId === id) cancelEdit();
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
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
          <div style={leftStyle}>
            <h2 style={formTitleStyle}>{editingId ? "🚩 予約内容を編集" : "新規予約登録"}</h2>
            
            <FormField label="日付選択">
              <input type="date" value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </FormField>

            <FormField label="予約者名">
              <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} placeholder="氏名" />
            </FormField>
            
            <FormField label="部署">
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            
            <FormField label="利用目的">
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle}>
                {purposePresets.map((p) => <option key={p}>{p}</option>)}
              </select>
            </FormField>

            <FormField label="参加人数">
              <select value={guestCount} onChange={(e) => setGuestCount(e.target.value)} style={fieldStyle}>
                {[...Array(9)].map((_, i) => <option key={i+1} value={String(i+1)}>{i+1}名</option>)}
                <option value="10+">10名以上</option>
              </select>
            </FormField>

            {purpose === "来客" && (
              <FormField label="来客者名（社名）">
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={{...fieldStyle, borderColor: "#2563eb", borderWidth: "2px"}} placeholder="株式会社〇〇" />
              </FormField>
            )}

            <FormField label="会議室">
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

            <button onClick={handleSave} style={{...buttonStyle, background: editingId ? "#f59e0b" : "#2563eb"}}>
              {editingId ? "変更を保存する" : "予約を確定する"}
            </button>
            {editingId && (
              <button onClick={cancelEdit} style={{...buttonStyle, background: "#6b7280", marginTop: 8}}>キャンセル</button>
            )}
          </div>

          <div style={rightStyle}>
            <div style={timelineCard}>
              <div style={timeHeaderRow}>
                <div style={{ width: 120, flexShrink: 0 }}></div>
                <div style={timeLabelsContainer}>
                  {times.filter((t) => t.endsWith(":00")).map((t) => (
                    <div key={t} style={{ ...timeLabelCell, position: "absolute", left: `${((toMin(t) - START_MIN) / TOTAL_MIN) * 100}%`, transform: "translateX(-50%)" }}>{t}</div>
                  ))}
                  <div style={{ ...timeLabelCell, position: "absolute", right: 0, transform: "translateX(50%)" }}>18:00</div>
                </div>
              </div>

              {rooms.map((roomName) => (
                <div key={roomName} style={roomRow}>
                  <div style={roomLabel}>{roomName}</div>
                  <div style={timelineTrack}>
                    {times.map((t) => (
                      <div key={t} style={{ ...gridLine, left: `${((toMin(t) - START_MIN) / TOTAL_MIN) * 100}%`, background: t.endsWith(":00") ? "#e2e8f0" : "#f1f5f9", zIndex: 1 }} />
                    ))}
                    {list.filter((r) => r.room === roomName).map((r) => {
                      const leftPos = ((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100;
                      const widthVal = ((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100;
                      return (
                        <div key={r.id} onClick={() => startEdit(r)} style={{ ...barStyle, left: `${leftPos}%`, width: `${widthVal}%`, background: deptColors[r.department], zIndex: 2, cursor: "pointer", border: editingId === r.id ? "3px solid #000" : "none" }}>
                          <span style={barTextStyle}><strong>{r.name}</strong> ({r.guestCount}名)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={listGridArea}>
              {rooms.map(roomName => (
                <div key={roomName} style={roomListCard}>
                  <h3 style={roomListTitle}>{roomName}</h3>
                  <div style={scrollArea}>
                    {list.filter(r => r.room === roomName).map(r => (
                      <div key={r.id} style={{...compactItem, border: editingId === r.id ? "2px solid #f59e0b" : "1px solid #f1f5f9"}}>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={itemHeaderLine}>
                            <span style={itemTime}>{r.startTime}-{r.endTime}</span>
                            <span style={{...itemDeptBadge, background: deptColors[r.department]}}>{r.department[0]}</span>
                          </div>
                          <div style={itemName}><strong>{r.name}</strong></div>
                          <div style={itemPurpose}>{r.purpose}{r.clientName && `（${r.clientName}）`}</div>
                        </div>
                        <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                           <button onClick={() => startEdit(r)} style={editBtn}>✎</button>
                           <button onClick={() => removeReservation(r.id)} style={delBtn}>×</button>
                        </div>
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

// 共通パーツ
const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}><label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 4, color: "#4a5568" }}>{label}</label>{children}</div>
);

// 追加のスタイル
const editBtn = { background: "#fef3c7", color: "#d97706", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px", padding: "2px 6px" };

// CSSスタイル定数（変更なしの部分は維持）
const pageStyle = { background: "#f1f5f9", height: "100vh", padding: "15px 20px", fontFamily: "sans-serif", overflow: "hidden" };
const headerSection = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15, background: "#fff", padding: "10px 25px", borderRadius: "15px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const titleStyle = { fontSize: 22, fontWeight: "900", margin: 0, color: "#1e293b" };
const legendStyle = { display: "flex", gap: 15 };
const dateNavStyle = { display: "flex", alignItems: "center", gap: 12 };
const dateHeaderStyle = { fontSize: 19, fontWeight: "bold", color: "#1e293b", minWidth: "140px", textAlign: "center" };
const navBtnStyle = { padding: "6px 14px", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: "bold", fontSize: "12px" };
const mainLayout = { display: "flex", gap: 20, height: "calc(100vh - 90px)" };
const leftStyle = { width: 300, background: "#fff", padding: "20px", borderRadius: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", height: "fit-content" };
const formTitleStyle = { fontSize: 17, marginBottom: 15, borderBottom: "2px solid #f1f5f9", paddingBottom: 8, fontWeight: "bold" };
const fieldStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const buttonStyle = { width: "100%", padding: "14px", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", marginTop: "10px" };
const rightStyle = { flex: 1, display: "flex", flexDirection: "column", gap: 15, height: "100%" };
const timelineCard = { background: "#fff", padding: "20px", borderRadius: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" };
const timeHeaderRow = { display: "flex", marginBottom: 15, height: 20, position: "relative" };
const timeLabelsContainer = { display: "flex", flex: 1, position: "relative" };
const timeLabelCell = { fontSize: 11, color: "#64748b", fontWeight: "bold", whiteSpace: "nowrap" };
const roomRow = { display: "flex", alignItems: "center", marginBottom: 12 };
const roomLabel = { width: 120, fontSize: 14, fontWeight: "bold", color: "#334155", flexShrink: 0 };
const timelineTrack = { position: "relative", flex: 1, height: 42, background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden", boxSizing: "border-box" };
const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1 };
const barStyle = { position: "absolute", top: 5, bottom: 5, borderRadius: "5px", color: "#fff", display: "flex", alignItems: "center", padding: "0 10px", fontSize: "11px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", boxSizing: "border-box", minWidth: "2px" };
const barTextStyle = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const listGridArea = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, flex: 1, overflow: "hidden", paddingBottom: "5px" };
const roomListCard = { background: "#fff", borderRadius: "15px", padding: "12px", display: "flex", flexDirection: "column", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" };
const roomListTitle = { fontSize: 15, fontWeight: "bold", color: "#1e293b", marginBottom: 10, borderLeft: "4px solid #1e293b", paddingLeft: 8 };
const scrollArea = { flex: 1, overflowY: "auto" };
const compactItem = { display: "flex", alignItems: "flex-start", background: "#f8fafc", padding: "8px 10px", borderRadius: "8px", marginBottom: 6 };
const itemHeaderLine = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 };
const itemTime = { fontSize: "11px", color: "#1e293b", fontWeight: "bold" };
const itemDeptBadge = { color: "#fff", fontSize: "9px", width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "3px", fontWeight: "bold" };
const itemName = { fontSize: "13px", color: "#1e293b", marginBottom: 1 };
const itemPurpose = { fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const delBtn = { background: "none", color: "#ef4444", border: "none", padding: "2px 5px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" };
