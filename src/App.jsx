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
  updateDoc,
} from "firebase/firestore";

export default function App() {
  const [viewMode, setViewMode] = useState("room");

  const configs = {
    room: {
      title: "会議室予約システム",
      collection: "reservations", 
      items: ["会議室", "応接室", "空き1", "空き2"],
      extraLabel: "来客者名（社名）",
      extraPlaceholder: "株式会社〇〇",
      unit: "名",
    },
    car: {
      title: "社用車予約システム",
      collection: "car_reservations",
      items: ["カローラ", "キャロル", "タイタン（２ｔ）", "ハイゼット"],
      extraLabel: "行き先",
      extraPlaceholder: "〇〇工場 / 市役所",
      unit: "名",
    }
  };

  const current = configs[viewMode];

  const getInitialJSTDate = () => {
    const now = new Date();
    const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return jstNow.toISOString().split("T")[0];
  };

  const [date, setDate] = useState(getInitialJSTDate());
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("新門司製造部");
  const [purpose, setPurpose] = useState("会議"); 
  const [clientName, setClientName] = useState(""); // タブレット側に合わせて名称固定
  const [guestCount, setGuestCount] = useState("1"); 
  const [selectedItem, setSelectedItem] = useState(configs.room.items[0]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [list, setList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const START_HOUR = 8;
  const END_HOUR = 18;
  const START_MIN = START_HOUR * 60;
  const END_MIN = END_HOUR * 60;
  const TOTAL_MIN = END_MIN - START_MIN;

  const departments = ["新門司製造部", "新門司セラミック", "総務部", "役員", "その他"];
  const purposePresets = viewMode === "room" 
    ? ["会議", "来客", "面談", "面接", "その他"]
    : ["納品", "引取", "外出", "その他"];

  const deptColors = {
    新門司製造部: "#3b82f6",
    新門司セラミック: "#10b981",
    総務部: "#f59e0b",
    役員: "#8b5cf6",
    その他: "#6b7280",
  };

  useEffect(() => {
    setSelectedItem(current.items[0]);
    setPurpose(viewMode === "room" ? "会議" : "納品");
    cancelEdit();
  }, [viewMode]);

  useEffect(() => {
    const q = query(collection(db, current.collection), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      const rawData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const now = new Date();
      const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      const todayStr = jstNow.toISOString().split("T")[0];
      const currentTimeStr = jstNow.toISOString().substring(11, 16);

      if (date === todayStr) {
        rawData.forEach(async (res) => {
          if (res.endTime < currentTimeStr) {
            try {
              await deleteDoc(doc(db, current.collection, res.id));
            } catch (e) { console.error("Auto-delete error:", e); }
          }
        });
      }

      const activeRes = rawData
        .filter(res => (date === todayStr ? res.endTime >= currentTimeStr : true))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      setList(activeRes);
    });
    return () => unsub();
  }, [date, viewMode]);

  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${day}`);
    cancelEdit();
  };

  const toMin = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const isOverlapping = () =>
    list.some(r => 
      r.id !== editingId && 
      (r.selectedItem === selectedItem || r.room === selectedItem) &&
      !(toMin(end) <= toMin(r.startTime) || toMin(start) >= toMin(r.endTime))
    );

  const startEdit = (r) => {
    setEditingId(r.id);
    setName(r.name || r.user || ""); // タブレット側のuserフィールドも考慮
    setDepartment(r.department || r.dept || ""); // タブレット側のdeptフィールドも考慮
    setPurpose(r.purpose || "");
    setClientName(r.clientName || r.extraInfo || ""); 
    setGuestCount(r.guestCount || "1");
    setSelectedItem(r.selectedItem || r.room);
    setStart(r.startTime || "");
    setEnd(r.endTime || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setClientName("");
    setGuestCount("1");
    setStart("09:00");
    setEnd("10:00");
  };

  const handleSave = async () => {
    if (!name || !purpose) return alert("未入力の項目があります");
    if (viewMode === "room" && purpose === "来客" && !clientName) return alert("来客社名を入力してください");
    if (viewMode === "car" && !clientName) return alert("行き先を入力してください");
    if (toMin(start) >= toMin(end)) return alert("終了時間は開始時間より後に設定してください");
    if (isOverlapping()) return alert(`⚠️既に予約が入っています。`);

    const reservationData = { 
      date, 
      name, 
      user: name, // タブレット側が user を見ているため追加
      department, 
      dept: department, // タブレット側が dept を見ているため追加
      purpose, 
      clientName, // タブレット側に合わせる
      guestCount,
      selectedItem, 
      room: selectedItem, // タブレット側に合わせる
      startTime: start, 
      endTime: end,
      updatedAt: new Date()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, current.collection, editingId), reservationData);
        alert("予約を更新しました");
      } else {
        await addDoc(collection(db, current.collection), { ...reservationData, createdAt: new Date() });
      }
      cancelEdit();
    } catch (e) {
      alert("保存に失敗しました。");
    }
  };

  const removeReservation = async (id) => {
    if (!window.confirm("この予約を削除してもよろしいですか？")) return;
    await deleteDoc(doc(db, current.collection, id));
    if (editingId === id) cancelEdit();
  };

  const tabBtnStyle = (isActive) => ({
    padding: "10px 24px",
    cursor: "pointer",
    borderRadius: "10px 10px 0 0",
    border: "none",
    background: isActive ? "#fff" : "#e2e8f0",
    color: isActive ? "#2563eb" : "#64748b",
    fontWeight: "bold",
    fontSize: "14px",
    transition: "0.2s"
  });

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        
        <div style={{ display: "flex", gap: 5, marginBottom: -1 }}>
          <button onClick={() => setViewMode("room")} style={tabBtnStyle(viewMode === "room")}>🏢 会議室予約</button>
          <button onClick={() => setViewMode("car")} style={tabBtnStyle(viewMode === "car")}>🚗 社用車予約</button>
        </div>

        <div style={headerSection}>
          <h1 style={titleStyle}>{current.title}</h1>
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
            <h2 style={formTitleStyle}>{editingId ? "🚩 編集" : "新規登録"}</h2>
            <FormField label="日付">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
            </FormField>
            <FormField label="名前">
              <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} placeholder="氏名" />
            </FormField>
            <FormField label="部署">
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="目的">
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle}>
                {purposePresets.map((p) => <option key={p}>{p}</option>)}
              </select>
            </FormField>
            
            {(viewMode === "car" || (viewMode === "room" && purpose === "来客")) && (
              <FormField label={current.extraLabel}>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={{...fieldStyle, borderColor: "#2563eb"}} placeholder={current.extraPlaceholder} />
              </FormField>
            )}

            <FormField label={viewMode === "room" ? "会議室" : "車両名"}>
              <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} style={fieldStyle}>
                {current.items.map((item) => <option key={item}>{item}</option>)}
              </select>
            </FormField>
            
            <div style={{ display: "flex", gap: 10 }}>
              <FormField label="開始">
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} />
              </FormField>
              <FormField label="終了">
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} />
              </FormField>
            </div>

            <button onClick={handleSave} style={{...buttonStyle, background: editingId ? "#f59e0b" : "#2563eb"}}>
              {editingId ? "更新する" : "予約する"}
            </button>
            {editingId && <button onClick={cancelEdit} style={{...buttonStyle, background: "#6b7280", marginTop: 8}}>キャンセル</button>}
          </div>

          <div style={rightStyle}>
            <div style={timelineCard}>
              <div style={timeHeaderRow}>
                <div style={{ width: 120 }}></div>
                <div style={timeLabelsContainer}>
                  {[...Array(11)].map((_, i) => (
                    <div key={i} style={{ ...timeLabelCell, position: "absolute", left: `${((i * 60) / TOTAL_MIN) * 100}%` }}>{START_HOUR + i}:00</div>
                  ))}
                </div>
              </div>
              {current.items.map((itemName) => (
                <div key={itemName} style={roomRow}>
                  <div style={roomLabel}>{itemName}</div>
                  <div style={timelineTrack}>
                    {list.filter((r) => (r.selectedItem === itemName || r.room === itemName)).map((r) => (
                      <div key={r.id} onClick={() => startEdit(r)} style={{ ...barStyle, left: `${((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100}%`, width: `${((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100}%`, background: deptColors[r.department || r.dept] }}>
                        <span style={barTextStyle}><strong>{r.name || r.user}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* 一覧エリア省略（上部のフルコードと同様） */}
          </div>
        </div>
      </div>
    </div>
  );
}

const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}><label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 4 }}>{label}</label>{children}</div>
);

// スタイルは以前のものを継承（一部簡略化して掲載）
const pageStyle = { background: "#f1f5f9", minHeight: "100vh", padding: "15px 20px", fontFamily: "sans-serif" };
const headerSection = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15, background: "#fff", padding: "10px 25px", borderRadius: "0 15px 15px 15px" };
const titleStyle = { fontSize: 22, fontWeight: "900", margin: 0 };
const legendStyle = { display: "flex", gap: 15 };
const dateNavStyle = { display: "flex", alignItems: "center", gap: 12 };
const dateHeaderStyle = { fontSize: 19, fontWeight: "bold", minWidth: "140px", textAlign: "center" };
const navBtnStyle = { padding: "6px 14px", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1" };
const mainLayout = { display: "flex", gap: 20, height: "calc(100vh - 160px)" };
const leftStyle = { width: 300, background: "#fff", padding: "20px", borderRadius: "20px", height: "fit-content" };
const formTitleStyle = { fontSize: 17, marginBottom: 15, borderBottom: "2px solid #f1f5f9", paddingBottom: 8, fontWeight: "bold" };
const fieldStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", boxSizing: "border-box" };
const buttonStyle = { width: "100%", padding: "14px", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" };
const rightStyle = { flex: 1, display: "flex", flexDirection: "column", gap: 15 };
const timelineCard = { background: "#fff", padding: "20px", borderRadius: "20px" };
const timeHeaderRow = { display: "flex", marginBottom: 15, height: 20, position: "relative" };
const timeLabelsContainer = { display: "flex", flex: 1, position: "relative" };
const timeLabelCell = { fontSize: 11, color: "#64748b", transform: "translateX(-50%)" };
const roomRow = { display: "flex", alignItems: "center", marginBottom: 12 };
const roomLabel = { width: 120, fontSize: 14, fontWeight: "bold", flexShrink: 0 };
const timelineTrack = { position: "relative", flex: 1, height: 42, background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" };
const barStyle = { position: "absolute", top: 5, bottom: 5, borderRadius: "5px", color: "#fff", display: "flex", alignItems: "center", padding: "0 10px", fontSize: "11px", cursor: "pointer" };
const barTextStyle = { overflow: "hidden", whiteSpace: "nowrap" };
