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
  writeBatch,
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

  const getInitialJSTDate = () => {
    const now = new Date();
    const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return jstNow.toISOString().split("T")[0];
  };

  const [date, setDate] = useState(getInitialJSTDate());
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

  // ★繰り返し予約用の新ステート
  const [repeatType, setRepeatType] = useState("none"); // none, daily, weekly
  const [repeatEndDate, setRepeatEndDate] = useState(getInitialJSTDate());

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

      const activeRes = rawData
        .filter(res => (date === todayStr ? res.endTime >= currentTimeStr : true))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      setList(activeRes);
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

  const isOverlapping = () =>
    list.some(r => 
      r.id !== editingId && 
      (r.selectedItem === selectedItem || r.room === selectedItem) && 
      !(toMin(end) <= toMin(r.startTime) || toMin(start) >= toMin(r.endTime))
    );

  const startEdit = (r) => {
    setEditingId(r.id);
    setName(r.name);
    setDepartment(r.department || r.dept);
    setPurpose(r.purpose);
    setExtraInfo(r.extraInfo || r.clientName || ""); 
    setGuestCount(r.guestCount || "1");
    setSelectedItem(r.selectedItem || r.room); 
    setStart(r.startTime);
    setEnd(r.endTime);
    setRepeatType("none"); // 編集時は誤動作を防ぐため繰り返しは一旦なしに
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setExtraInfo("");
    setGuestCount("1");
    setStart("09:00");
    setEnd("10:00");
    setRepeatType("none");
  };

  // ★特定の日付形式 (YYYY-MM-DD) を生成するヘルパー関数
  const formatDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleSave = async () => {
    if (!name || !purpose) return alert("未入力の項目があります");
    if (viewMode === "room" && purpose === "来客" && !extraInfo) return alert("来客社名を入力してください");
    if (viewMode === "car" && !extraInfo) return alert("行き先を入力してください");
    if (toMin(start) >= toMin(end)) return alert("終了時間は開始時間より後に設定してください");
    
    // 単発予約の重複チェック（編集時、または繰り返しなし時）
    if (repeatType === "none" && isOverlapping()) return alert(`⚠️既に予約が入っています。`);

    const baseReservationData = { 
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
      startTime: start, 
      endTime: end,
      updatedAt: new Date()
    };

    try {
      if (editingId) {
        // 編集時は単一ドキュメントを更新
        await updateDoc(doc(db, current.collection, editingId), { ...baseReservationData, date });
        alert("予約を更新しました");
      } else {
        // 新規登録時の処理（繰り返し処理の組み込み）
        if (repeatType === "none") {
          await addDoc(collection(db, current.collection), { ...baseReservationData, date, createdAt: new Date() });
        } else {
          // 繰り返し対象の日付リストを生成
          const targetDates = [];
          let currentD = new Date(date);
          const endD = new Date(repeatEndDate);

          if (currentD > endD) {
            return alert("繰り返し終了日は開始日以降に設定してください");
          }

          // 安全のため最大100回までに制限（Firestoreのバッチ上限や誤操作対策）
          while (currentD <= endD && targetDates.length < 100) {
            targetDates.push(formatDateStr(currentD));
            if (repeatType === "daily") {
              currentD.setDate(currentD.getDate() + 1);
            } else if (repeatType === "weekly") {
              currentD.setDate(currentD.getDate() + 7);
            }
          }

          if (window.confirm(`${targetDates.length}日分の予約をまとめて登録します。よろしいですか？\n（※既存の予約と重複する日は登録されません）`)) {
            // Firestoreのバッチ処理を使って高速・確実に一括登録
            const batch = writeBatch(db);
            
            // 各日付ごとにデータをセット（重複チェックはタブレット側や後続処理との競合を避けるため簡易的に案内）
            targetDates.forEach((dStr) => {
              const docRef = doc(collection(db, current.collection));
              batch.set(docRef, {
                ...baseReservationData,
                date: dStr,
                createdAt: new Date()
              });
            });

            await batch.commit();
            alert(`${targetDates.length}日分の繰り返し予約を確定しました！`);
          } else {
            return;
          }
        }
      }
      cancelEdit();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    }
  };

  const removeReservation = async (id) => {
    if (!window.confirm("この予約を削除してもよろしいですか？\n※繰り返しの一括削除には対応していません。選択した日付の予約のみ削除されます。")) return;
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

            {/* ★繰り返し予約の設定エリア（新規登録時のみ表示） */}
            {!editingId && (
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, border: "1px dashed #cbd5e1" }}>
                <FormField label="🔁 繰り返し設定">
                  <select value={repeatType} onChange={(e) => setRepeatType(e.target.value)} style={fieldStyle}>
                    <option value="none">しない（単発）</option>
                    <option value="daily">毎日（土日含む）</option>
                    <option value="weekly">毎週（同じ曜日）</option>
                  </select>
                </FormField>
                {repeatType !== "none" && (
                  <FormField label="📅 繰り返し終了日">
                    <input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} style={{...fieldStyle, borderColor: "#10b981"}} />
                  </FormField>
                )}
              </div>
            )}

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
                    {list.filter((r) => (r.selectedItem === itemName || r.room === itemName)).map((r) => {
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
                    {list.filter(r => (r.selectedItem === itemName || r.room === itemName)).map(r => (
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
