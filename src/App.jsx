"use client";
import { useEffect, useState } from "react";
// ★ パスを2つ上の階層（../../）に修正してビルドエラーを解決！
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

  // 【安定化】端末の現在の日付をそのまま取得
  const getInitialDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [date, setDate] = useState(getInitialDate());
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("新門司製造部");
  const [purpose, setPurpose] = useState("会議"); 
  const [extraInfo, setExtraInfo] = useState("");
  const [guestCount, setGuestCount] = useState("1"); 
  const [selectedItem, setSelectedItem] = useState(configs.room.items[0]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  
  // list（画面表示用）と allRawData（重複チェック用）を分ける
  const [list, setList] = useState([]);
  const [allRawData, setAllRawData] = useState([]); 
  
  const [editingId, setEditingId] = useState(null);

  // ★ まとめて予約（繰り返し）用のState
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState("daily"); // daily(毎日) or weekly(毎週)
  const [recurringCount, setRecurringCount] = useState(5);     // 繰り返す回数

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
      // データベースから持ってきた生のデータをすべて保持
      const rawData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllRawData(rawData); // ← 重複チェックはこっちを使う
      
      // 画面のリスト表示用（過去の時間は非表示にする処理）
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      
      const currentTimeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

      const activeRes = rawData
        .filter(res => (date === todayStr ? res.endTime >= currentTimeStr : true))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      setList(activeRes); // ← 画面に映すのはこっち
    }, (error) => {
      console.error("Firestore Listen Error:", error);
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

  // 【完全修正版】重複チェック（バグらないように `allRawData` を使用）
  const isOverlapping = () => {
    const newStart = toMin(start);
    const newEnd = toMin(end);
    
    // 画面の見た目（list）ではなく、その日のデータベース全件（allRawData）と照らし合わせる
    return allRawData.some(r => {
      // 1. 自身の編集データならスキップ
      if (editingId && r.id === editingId) return false;
      
      // 2. 部屋・車両名が完全に一致しているかチェック
      const targetItem = r.selectedItem || r.room || r.item;
      if (targetItem !== selectedItem) return false; 

      // 3. 時間の重なり判定（開始と終了の時間が少しでも被っていれば true）
      const existStart = toMin(r.startTime);
      const existEnd = toMin(r.endTime);

      // ★ 前のコードの「うまく動いていた条件式」をそのまま採用して安全性を確保
      return !(newEnd <= existStart || newStart >= existEnd);
    });
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setName(r.name || r.user);
    setDepartment(r.department || r.dept);
    setPurpose(r.purpose);
    setExtraInfo(r.extraInfo || r.clientName || ""); 
    setGuestCount(r.guestCount || "1");
    setSelectedItem(r.selectedItem || r.room || r.item || current.items[0]); 
    setStart(r.startTime);
    setEnd(r.endTime);
    setIsRecurring(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (viewMode === "room" && purpose === "来客" && !extraInfo) return alert("来客社名を入力してください");
    if (viewMode === "car" && !extraInfo) return alert("行き先を入力してください");
    if (toMin(start) >= toMin(end)) return alert("終了時間は開始時間より後に設定してください");
    
    // ★ 重複チェックで弾かれた場合
    if (!isRecurring && isOverlapping()) {
      return alert("⚠️既に同じ時間帯に予約が入っています。時間を変更してください。");
    }

    const baseData = { 
      name, 
      user: name,
      department, 
      dept: department,
      purpose, 
      extraInfo,
      clientName: extraInfo,
      guestCount,
      selectedItem, 
      room: selectedItem, 
      item: selectedItem,
      startTime: start, 
      endTime: end,
      updatedAt: new Date()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, current.collection, editingId), { ...baseData, date });
        alert("予約を更新しました");
      } else if (isRecurring) {
        const count = Number(recurringCount);
        if (isNaN(count) || count < 1 || count > 31) {
          return alert("繰り返しの回数は1〜31の間で入力してください");
        }

        if (!window.confirm(`${count}日分の予約をまとめて登録します。よろしいですか？\n（※別日の重複チェックはスキップされます）`)) return;

        let baseDate = new Date(date);
        
        for (let i = 0; i < count; i++) {
          const y = baseDate.getFullYear();
          const m = String(baseDate.getMonth() + 1).padStart(2, '0');
          const d = String(baseDate.getDate()).padStart(2, '0');
          const targetDateStr = `${y}-${m}-${d}`;

          await addDoc(collection(db, current.collection), { 
            ...baseData, 
            date: targetDateStr,
            createdAt: new Date() 
          });

          if (recurringType === "daily") {
            baseDate.setDate(baseDate.getDate() + 1);
          } else {
            baseDate.setDate(baseDate.getDate() + 7);
          }
        }
        alert(`${count}件の予約をまとめて登録しました！`);
      } else {
        await addDoc(collection(db, current.collection), { ...baseData, date, createdAt: new Date() });
        alert("予約を確定しました");
      }
      cancelEdit();
    } catch (e) {
      console.error(e);
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
    boxShadow: isActive ? "0 -2px 10px rgba(0,0,0,0.05)" : "none",
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
            <h2 style={formTitleStyle}>{editingId ? "🚩 予約内容を編集" : "新規予約登録"}</h2>
            <FormField label="日付選択">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
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
            <FormField label={viewMode === "room" ? "参加人数" : "乗車人数"}>
              <select value={guestCount} onChange={(e) => setGuestCount(e.target.value)} style={fieldStyle}>
                {[...Array(9)].map((_, i) => <option key={i+1} value={String(i+1)}>{i+1}名</option>)}
                <option value="10+">10名以上</option>
              </select>
            </FormField>
            
            {(viewMode === "car" || (viewMode === "room" && purpose === "来客")) && (
              <FormField label={current.extraLabel}>
                <input 
                  value={extraInfo} 
                  onChange={(e) => setExtraInfo(e.target.value)} 
                  style={{...fieldStyle, borderColor: "#2563eb", borderWidth: "2px"}} 
                  placeholder={current.extraPlaceholder} 
                />
              </FormField>
            )}

            <FormField label={viewMode === "room" ? "会議室" : "車両名"}>
              <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} style={fieldStyle}>
                {current.items.map((item) => <option key={item}>{item}</option>)}
              </select>
            </FormField>
            
            <div style={{ display: "flex", gap: 10 }}>
              <FormField label="開始時刻">
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} />
              </FormField>
              <FormField label="終了時刻">
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} />
              </FormField>
            </div>

            {!editingId && (
              <div style={recurringBoxStyle}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: "bold", cursor: "pointer", color: "#1e293b" }}>
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} style={{ width: 16, height: 16 }} />
                  定期予約（まとめて登録）にする
                </label>
                
                {isRecurring && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8, borderLeft: "2px solid #cbd5e1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                      <span>頻度:</span>
                      <label><input type="radio" checked={recurringType === "daily"} onChange={() => setRecurringType("daily")} /> 毎日</label>
                      <label><input type="radio" checked={recurringType === "weekly"} onChange={() => setRecurringType("weekly")} /> 毎週</label>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span>回数:</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="31" 
                        value={recurringCount} 
                        onChange={(e) => setRecurringCount(e.target.value)} 
                        style={{ width: 60, padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1", textAlign: "center" }}
                      />
                      <span>回分 ({recurringType === "daily" ? "日間" : "週間"})</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleSave} style={{...buttonStyle, background: editingId ? "#f59e0b" : "#2563eb"}}>
              {editingId ? "変更を保存する" : isRecurring ? "まとめて予約を確定する" : "予約を確定する"}
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
                  {[...Array(11)].map((_, i) => {
                    const h = START_HOUR + i;
                    return (
                      <div key={h} style={{ ...timeLabelCell, position: "absolute", left: `${((i * 60) / TOTAL_MIN) * 100}%`, transform: "translateX(-50%)" }}>{h}:00</div>
                    );
                  })}
                </div>
              </div>
              {current.items.map((itemName) => (
                <div key={itemName} style={roomRow}>
                  <div style={roomLabel}>{itemName}</div>
                  <div style={timelineTrack}>
                    {[...Array(21)].map((_, i) => (
                      <div key={i} style={{ ...gridLine, left: `${(i * 30 / TOTAL_MIN) * 100}%`, background: i % 2 === 0 ? "#e2e8f0" : "#f1f5f9", zIndex: 1 }} />
                    ))}
                    {list.filter((r) => (r.selectedItem === itemName || r.room === itemName || r.item === itemName)).map((r) => {
                      const leftPos = ((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100;
                      const widthVal = ((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100;
                      return (
                        <div key={r.id} onClick={() => startEdit(r)} style={{ ...barStyle, left: `${leftPos}%`, width: `${widthVal}%`, background: deptColors[r.department || r.dept], zIndex: 2, cursor: "pointer", border: editingId === r.id ? "3px solid #000" : "none" }}>
                          <span style={barTextStyle}><strong>{r.name || r.user}</strong> ({r.guestCount || "1"}{current.unit})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={listGridArea}>
              {current.items.map(itemName => (
                <div key={itemName} style={roomListCard}>
                  <h3 style={roomListTitle}>{itemName}</h3>
                  <div style={scrollArea}>
                    {list.filter(r => (r.selectedItem === itemName || r.room === itemName || r.item === itemName)).map(r => (
                      <div key={r.id} style={{...compactItem, border: editingId === r.id ? "2px solid #f59e0b" : "1px solid #f1f5f9"}}>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={itemHeaderLine}>
                            <span style={itemTime}>{r.startTime}-{r.endTime}</span>
                            <span style={{...itemDeptBadge, background: deptColors[r.department || r.dept]}}>{(r.department || r.dept || "そ")[0]}</span>
                          </div>
                          <div style={itemNameStyle}><strong>{r.name || r.user}</strong></div>
                          <div style={itemPurpose}>{r.purpose}{(r.extraInfo || r.clientName) && `（${r.extraInfo || r.clientName}）`}</div>
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

const FormField = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}><label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 4, color: "#4a5568" }}>{label}</label>{children}</div>
);

const recurringBoxStyle = { background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px dashed #cbd5e1", marginBottom: "12px", marginTop: "15px" };
const editBtn = { background: "#fef3c7", color: "#d97706", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px", padding: "2px 6px" };
const pageStyle = { background: "#f1f5f9", minHeight: "100vh", padding: "15px 20px", fontFamily: "sans-serif" };
const headerSection = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15, background: "#fff", padding: "10px 25px", borderRadius: "0 15px 15px 15px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const titleStyle = { fontSize: 22, fontWeight: "900", margin: 0, color: "#1e293b" };
const legendStyle = { display: "flex", gap: 15 };
const dateNavStyle = { display: "flex", alignItems: "center", gap: 12 };
const dateHeaderStyle = { fontSize: 19, fontWeight: "bold", color: "#1e293b", minWidth: "140px", textAlign: "center" };
const navBtnStyle = { padding: "6px 14px", cursor: "pointer", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: "bold", fontSize: "12px" };
const mainLayout = { display: "flex", gap: 20, height: "calc(100vh - 160px)" };
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
const itemNameStyle = { fontSize: "13px", color: "#1e293b", marginBottom: 1 };
const itemPurpose = { fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const delBtn = { background: "none", color: "#ef4444", border: "none", padding: "2px 5px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" };
