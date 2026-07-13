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
      items: ["会議室①", "会議室②", "応接室", "食堂"],
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

  const getJSTDateString = (dateObj = new Date()) => {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(dateObj).replace(/\//g, "-");
  };

  const getJSTTimeString = (dateObj = new Date()) => {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(dateObj);
  };

  const [date, setDate] = useState("2026-01-01");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("新門司製造部");
  const [purpose, setPurpose] = useState("会議"); 
  const [extraInfo, setExtraInfo] = useState("");
  const [guestCount, setGuestCount] = useState("1"); 
  const [selectedItem, setSelectedItem] = useState(configs.room.items[0]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [list, setList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState("daily"); 
  const [recurringCount, setRecurringCount] = useState(5);     

  const START_HOUR = 8;
  const END_HOUR = 18;
  const START_MIN = START_HOUR * 60;
  const END_MIN = END_HOUR * 60;
  const TOTAL_MIN = END_MIN - START_MIN;

  const departments = ["新門司製造部", "新門司セラミック", "総務部", "役員", "その他"];
  const purposePresets = viewMode === "room" ? ["会議", "来客", "面談", "面接", "その他"] : ["納品", "引取", "外出", "その他"];
  const deptColors = { "新門司製造部": "#3b82f6", "新門司セラミック": "#10b981", "総務部": "#f59e0b", "役員": "#8b5cf6", "その他": "#6b7280" };

  useEffect(() => { setDate(getJSTDateString()); }, []);

  useEffect(() => {
    setSelectedItem(current.items[0]);
    setPurpose(viewMode === "room" ? "会議" : "納品");
    cancelEdit();
  }, [viewMode]);

  // ★ 削除を確実に待機してから画面更新するロジック
  useEffect(() => {
    if (date === "2026-01-01") return;

    const q = query(collection(db, current.collection), where("date", "==", date));
    
    const unsub = onSnapshot(q, async (snap) => {
      const todayStr = getJSTDateString();
      const currentTimeStr = getJSTTimeString();
      
      const docsToDelete = [];
      const validDocs = [];

      snap.docs.forEach((d) => {
        const data = d.data();
        if (date === todayStr && data.endTime && data.endTime < currentTimeStr) {
          docsToDelete.push(deleteDoc(doc(db, current.collection, d.id)));
        } else {
          validDocs.push({ id: d.id, ...data });
        }
      });

      if (docsToDelete.length > 0) {
        await Promise.all(docsToDelete);
      }
      setList(validDocs.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")));
    });
    
    return () => unsub();
  }, [date, viewMode]);

  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(getJSTDateString(d));
  };

  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const isOverlapping = () =>
    list.some(r => {
      if (r.id === editingId) return false;
      const targetItem = r.selectedItem || r.room;
      if (targetItem === selectedItem) {
        return !(toMin(end) <= toMin(r.startTime) || toMin(start) >= toMin(r.endTime));
      }
      return false;
    });

  const startEdit = (r) => {
    setEditingId(r.id);
    setName(r.name || r.user || "");
    setDepartment(r.department || r.dept || "新門司製造部");
    setPurpose(r.purpose || "");
    setExtraInfo(r.extraInfo || r.clientName || ""); 
    setGuestCount(r.guestCount || "1");
    setSelectedItem(r.selectedItem || r.room || current.items[0]); 
    setStart(r.startTime || "09:00");
    setEnd(r.endTime || "10:00");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setExtraInfo("");
    setGuestCount("1");
    setStart("09:00");
    setEnd("10:00");
    setIsRecurring(false);
  };

  const handleSave = async () => {
    if (!name || !purpose) return alert("未入力の項目があります");
    if (toMin(start) >= toMin(end)) return alert("時間は正しく設定してください");
    if (!isRecurring && isOverlapping()) return alert("⚠️ この時間は既に予約済みです");

    const baseData = { 
      name, user: name, department, dept: department,
      purpose, extraInfo, clientName: extraInfo,
      guestCount, selectedItem, room: selectedItem, 
      startTime: start, endTime: end, updatedAt: new Date()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, current.collection, editingId), { ...baseData, date });
      } else if (isRecurring) {
        let baseDate = new Date(date);
        for (let i = 0; i < Number(recurringCount); i++) {
          await addDoc(collection(db, current.collection), { ...baseData, date: getJSTDateString(baseDate), createdAt: new Date() });
          baseDate.setDate(baseDate.getDate() + (recurringType === "daily" ? 1 : 7));
        }
      } else {
        await addDoc(collection(db, current.collection), { ...baseData, date, createdAt: new Date() });
      }
      cancelEdit();
    } catch (e) { alert("保存に失敗しました"); }
  };

  const removeReservation = async (id) => {
    if (confirm("削除しますか？")) await deleteDoc(doc(db, current.collection, id));
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 5, marginBottom: -1 }}>
          <button onClick={() => setViewMode("room")} style={tabBtnStyle(viewMode === "room")}>🏢 会議室</button>
          <button onClick={() => setViewMode("car")} style={tabBtnStyle(viewMode === "car")}>🚗 社用車</button>
        </div>
        <div style={headerSection}>
          <h1 style={titleStyle}>{current.title}</h1>
          <div style={dateNavStyle}>
            <button onClick={() => changeDate(-1)} style={navBtnStyle}>◀ 前日</button>
            <span style={dateHeaderStyle}>📅 {date}</span>
            <button onClick={() => changeDate(1)} style={navBtnStyle}>翌日 ▶</button>
          </div>
        </div>
        <div style={mainLayout}>
          <div style={leftStyle}>
            <h2 style={formTitleStyle}>{editingId ? "編集" : "新規予約"}</h2>
            <FormField label="予約者名"><input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></FormField>
            <FormField label="利用目的"><select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={fieldStyle}>{purposePresets.map(p => <option key={p}>{p}</option>)}</select></FormField>
            <FormField label="対象"><select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} style={fieldStyle}>{current.items.map(item => <option key={item}>{item}</option>)}</select></FormField>
            <div style={{ display: "flex", gap: 10 }}><FormField label="開始"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} /></FormField><FormField label="終了"><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} /></FormField></div>
            <button onClick={handleSave} style={buttonStyle}>{editingId ? "更新" : "確定"}</button>
          </div>
          <div style={rightStyle}>
            <div style={timelineCard}>
              {current.items.map((item) => (
                <div key={item} style={roomRow}><div style={roomLabel}>{item}</div>
                  <div style={timelineTrack}>
                    {list.filter(r => (r.selectedItem === item || r.room === item)).map(r => (
                      <div key={r.id} onClick={() => startEdit(r)} style={{ ...barStyle, left: `${((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100}%`, width: `${((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100}%`, background: deptColors[r.department] || "#6b7280" }}>{r.name}</div>
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

const FormField = ({ label, children }) => (<div style={{ marginBottom: 10 }}><label style={{ fontSize: 12, fontWeight: "bold" }}>{label}</label>{children}</div>);
const pageStyle = { padding: 20, background: "#f1f5f9", minHeight: "100vh" };
const headerSection = { background: "#fff", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const titleStyle = { fontSize: 20, margin: 0 };
const dateNavStyle = { display: "flex", gap: 10, alignItems: "center" };
const dateHeaderStyle = { fontSize: 18, fontWeight: "bold" };
const navBtnStyle = { padding: "5px 10px", cursor: "pointer" };
const mainLayout = { display: "flex", gap: 20, marginTop: 20 };
const leftStyle = { width: 300, background: "#fff", padding: 20, borderRadius: 10 };
const fieldStyle = { width: "100%", padding: 8, boxSizing: "border-box" };
const buttonStyle = { width: "100%", padding: 10, background: "#2563eb", color: "#fff", border: "none", marginTop: 10, cursor: "pointer" };
const rightStyle = { flex: 1 };
const timelineCard = { background: "#fff", padding: 20, borderRadius: 10 };
const roomRow = { display: "flex", alignItems: "center", marginBottom: 10 };
const roomLabel = { width: 100, fontWeight: "bold" };
const timelineTrack = { flex: 1, height: 40, background: "#f8fafc", position: "relative", border: "1px solid #e2e8f0" };
const barStyle = { position: "absolute", top: 2, bottom: 2, borderRadius: 4, color: "#fff", fontSize: 10, padding: 2, cursor: "pointer" };
const tabBtnStyle = (active) => ({ padding: "10px 20px", background: active ? "#fff" : "#cbd5e1", border: "none", cursor: "pointer" });
const formTitleStyle = { fontSize: 16, marginBottom: 15 };
