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
  const [viewMode, setViewMode] = useState("room"); // "room" または "car"

  // --- 設定値の定義 ---
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

  // --- 状態管理 (タブレット側のキー名に合わせて定義) ---
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [user, setUser] = useState("");          // 予約者名
  const [dept, setDept] = useState("新門司製造部"); // 部署
  const [purpose, setPurpose] = useState("会議"); 
  const [clientName, setClientName] = useState(""); // 来客社名 or 行き先
  const [guestCount, setGuestCount] = useState("1"); 
  const [selectedRoom, setSelectedRoom] = useState(""); // 選択中の部屋/車両
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [list, setList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const START_HOUR = 8;
  const END_HOUR = 18;
  const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;

  const departments = ["新門司製造部", "新門司セラミック", "総務部", "役員", "その他"];
  const deptColors = {
    新門司製造部: "#3b82f6",
    新門司セラミック: "#10b981",
    総務部: "#f59e0b",
    役員: "#8b5cf6",
    その他: "#6b7280",
  };

  // --- 副作用処理 ---
  useEffect(() => {
    setSelectedRoom(current.items[0]);
    setPurpose(viewMode === "room" ? "会議" : "納品");
    cancelEdit();
  }, [viewMode]);

  useEffect(() => {
    const q = query(collection(db, current.collection), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      const rawData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // 自動削除ロジック (当日分のみ)
      const now = new Date();
      const currentTimeStr = now.toTimeString().substring(0, 5);
      const todayStr = new Date().toISOString().split("T")[0];

      if (date === todayStr) {
        rawData.forEach(async (res) => {
          if (res.endTime < currentTimeStr) {
            try { await deleteDoc(doc(db, current.collection, res.id)); } catch (e) {}
          }
        });
      }

      setList(rawData.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    });
    return () => unsub();
  }, [date, viewMode]);

  // --- ヘルパー関数 ---
  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
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
      (r.room === selectedRoom || r.selectedItem === selectedRoom) && 
      !(toMin(end) <= toMin(r.startTime) || toMin(start) >= toMin(r.endTime))
    );

  // --- アクション ---
  const startEdit = (r) => {
    setEditingId(r.id);
    setUser(r.user || r.name || "");
    setDept(r.dept || r.department || "新門司製造部");
    setPurpose(r.purpose || "");
    setClientName(r.clientName || r.extraInfo || "");
    setGuestCount(r.guestCount || "1");
    setSelectedRoom(r.room || r.selectedItem);
    setStart(r.startTime);
    setEnd(r.endTime);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setUser("");
    setClientName("");
    setGuestCount("1");
    setStart("09:00");
    setEnd("10:00");
  };

  const handleSave = async () => {
    if (!user || !purpose) return alert("未入力の項目があります");
    if (toMin(start) >= toMin(end)) return alert("終了時間は開始時間より後にしてください");
    if (isOverlapping()) return alert("⚠️既に予約が入っています");

    // タブレット側と管理画面側の両方のキー名を保持して保存
    const reservationData = {
      date,
      user,              // タブレット用
      name: user,        // 互換用
      dept,              // タブレット用
      department: dept,  // 互換用
      purpose,
      clientName,        // タブレット用
      extraInfo: clientName, // 互換用
      guestCount,
      room: selectedRoom, // タブレット用
      selectedItem: selectedRoom, // 互換用
      startTime: start,
      endTime: end,
      updatedAt: new Date()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, current.collection, editingId), reservationData);
        alert("更新しました");
      } else {
        await addDoc(collection(db, current.collection), { ...reservationData, createdAt: new Date() });
      }
      cancelEdit();
    } catch (e) { alert("保存失敗"); }
  };

  const removeReservation = async (id) => {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, current.collection, id));
    if (editingId === id) cancelEdit();
  };

  // --- UI部品スタイル ---
  const tabBtnStyle = (isActive) => ({
    padding: "12px 24px", cursor: "pointer", borderRadius: "10px 10px 0 0", border: "none",
    background: isActive ? "#fff" : "#e2e8f0", color: isActive ? "#2563eb" : "#64748b",
    fontWeight: "bold", fontSize: "14px", transition: "0.2s"
  });

  return (
    <div style={{ background: "#f1f5f9", minHeight: "100vh", padding: "15px 20px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        
        {/* タブ切り替え */}
        <div style={{ display: "flex", gap: 5, marginBottom: -1 }}>
          <button onClick={() => setViewMode("room")} style={tabBtnStyle(viewMode === "room")}>🏢 会議室予約</button>
          <button onClick={() => setViewMode("car")} style={tabBtnStyle(viewMode === "car")}>🚗 社用車予約</button>
        </div>

        {/* ヘッダーエリア */}
        <div style={headerStyle}>
          <h1 style={{ fontSize: 22, margin: 0, color: "#1e293b" }}>{current.title}</h1>
          <div style={{ display: "flex", gap: 15 }}>
            {Object.entries(deptColors).map(([d, c]) => (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <div style={{ width: 12, height: 12, background: c, borderRadius: 3 }} />{d}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => changeDate(-1)} style={navBtn}>◀ 前日</button>
            <span style={{ fontSize: 18, fontWeight: "bold" }}>📅 {date.replace(/-/g, "/")}</span>
            <button onClick={() => changeDate(1)} style={navBtn}>翌日 ▶</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {/* 左側：入力フォーム */}
          <div style={formCardStyle}>
            <h2 style={{ fontSize: 17, marginBottom: 15, borderBottom: "2px solid #f1f5f9", paddingBottom: 8 }}>
              {editingId ? "🚩 予約の編集" : "新規予約登録"}
            </h2>
            <div style={fieldGroup}>
              <label style={labelStyle}>予約者名</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} style={inputStyle} placeholder="名前" />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>部署</label>
              <select value={dept} onChange={(e) => setDept(e.target.value)} style={inputStyle}>
                {departments.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>利用目的 / {current.extraLabel}</label>
              <div style={{ display: "flex", gap: 5 }}>
                <input value={purpose} onChange={(e) => setPurpose(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="目的" />
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={{ ...inputStyle, flex: 1.5, borderColor: "#2563eb" }} placeholder={current.extraPlaceholder} />
              </div>
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>{viewMode === "room" ? "会議室選択" : "車両選択"}</label>
              <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} style={inputStyle}>
                {current.items.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>開始</label>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>終了</label>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <button onClick={handleSave} style={{ ...saveBtn, background: editingId ? "#f59e0b" : "#2563eb" }}>
              {editingId ? "変更を保存" : "予約を確定する"}
            </button>
            {editingId && <button onClick={cancelEdit} style={cancelBtn}>キャンセル</button>}
          </div>

          {/* 右側：タイムライン表示 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 15 }}>
            <div style={timelineCard}>
              <div style={{ display: "flex", marginBottom: 10, paddingLeft: 120 }}>
                {[...Array(11)].map((_, i) => (
                  <div key={i} style={{ flex: 1, fontSize: 11, color: "#64748b", textAlign: "left" }}>{START_HOUR + i}:00</div>
                ))}
              </div>
              {current.items.map(itemName => (
                <div key={itemName} style={rowStyle}>
                  <div style={rowLabel}>{itemName}</div>
                  <div style={trackStyle}>
                    {list.filter(r => (r.room === itemName || r.selectedItem === itemName)).map(r => (
                      <div
                        key={r.id}
                        onClick={() => startEdit(r)}
                        style={{
                          ...barStyle,
                          left: `${((toMin(r.startTime) - START_HOUR * 60) / TOTAL_MIN) * 100}%`,
                          width: `${((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100}%`,
                          background: deptColors[r.dept || r.department] || "#6b7280",
                          border: editingId === r.id ? "2px solid #000" : "none"
                        }}
                      >
                        {r.user || r.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 下部リスト表示 */}
            <div style={gridStyle}>
              {current.items.map(item => (
                <div key={item} style={listCard}>
                  <h4 style={listTitle}>{item}</h4>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {list.filter(r => (r.room === item || r.selectedItem === item)).map(r => (
                      <div key={r.id} style={listItem}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: "bold" }}>{r.startTime}-{r.endTime}</div>
                          <div style={{ fontSize: 13, fontWeight: "bold" }}>{r.user || r.name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{r.purpose} {r.clientName && `(${r.clientName})`}</div>
                        </div>
                        <button onClick={() => removeReservation(r.id)} style={delBtn}>×</button>
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

// --- スタイル定義 ---
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", padding: "10px 25px", borderRadius: "0 15px 15px 15px", marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const navBtn = { padding: "6px 12px", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff" };
const formCardStyle = { width: 320, background: "#fff", padding: 20, borderRadius: 20, boxShadow: "0 10px 25px rgba(0,0,0,0.05)", height: "fit-content" };
const fieldGroup = { marginBottom: 12 };
const labelStyle = { fontSize: 12, fontWeight: "bold", display: "block", marginBottom: 4, color: "#4a5568" };
const inputStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", boxSizing: "border-box" };
const saveBtn = { width: "100%", padding: "14px", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" };
const cancelBtn = { width: "100%", padding: "10px", background: "#64748b", color: "#fff", border: "none", borderRadius: "10px", marginTop: 8, cursor: "pointer" };
const timelineCard = { background: "#fff", padding: 20, borderRadius: 20, boxShadow: "0 10px 25px rgba(0,0,0,0.05)" };
const rowStyle = { display: "flex", alignItems: "center", marginBottom: 10 };
const rowLabel = { width: 120, fontSize: 14, fontWeight: "bold", color: "#334155" };
const trackStyle = { flex: 1, height: 36, background: "#f8fafc", borderRadius: 8, position: "relative", border: "1px solid #e2e8f0", overflow: "hidden" };
const barStyle = { position: "absolute", top: 4, bottom: 4, borderRadius: 4, color: "#fff", fontSize: 10, display: "flex", alignItems: "center", padding: "0 8px", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, flex: 1 };
const listCard = { background: "#fff", borderRadius: 15, padding: 12, height: 200, display: "flex", flexDirection: "column", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" };
const listTitle = { margin: "0 0 10px 0", fontSize: 14, borderLeft: "4px solid #1e293b", paddingLeft: 8 };
const listItem = { display: "flex", background: "#f8fafc", padding: 8, borderRadius: 8, marginBottom: 5, border: "1px solid #f1f5f9" };
const delBtn = { background: "none", border: "none", color: "#ef4444", fontSize: 18, cursor: "pointer", padding: "0 5px" };
