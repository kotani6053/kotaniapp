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

  // 端末のタイムゾーンに影響されない確実なJST（日本時間）の取得
  const getJSTDateString = (dateObj = new Date()) => {
    const formatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(dateObj).replace(/\//g, "-");
  };

  const getJSTTimeString = (dateObj = new Date()) => {
    const formatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    return formatter.format(dateObj);
  };

  // ★ハイドレーションエラー防止：初期値は固定値か空文字にし、マウント後にuseEffectで時間をセットする
  const [isMounted, setIsMounted] = useState(false);
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

  // ★ブラウザにマウント（読込完了）されたタイミングで、正しい今日の日付をセット
  useEffect(() => {
    setIsMounted(true);
    setDate(getJSTDateString());
  }, []);

  useEffect(() => {
    setSelectedItem(current.items[0]);
    setPurpose(viewMode === "room" ? "会議" : "納品");
    cancelEdit();
  }, [viewMode]);

  useEffect(() => {
    if (!isMounted) return; // マウント前はFirestoreの監視をスキップ

    const q = query(collection(db, current.collection), where("date", "==", date));
    
    const unsub = onSnapshot(q, (snap) => {
      const rawData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      const todayStr = getJSTDateString();
      const currentTimeStr = getJSTTimeString();

      const activeRes = rawData
        .filter(res => {
          if (date === todayStr) {
            const resEndTime = res.endTime || "";
            return resEndTime >= currentTimeStr;
          }
          return true;
        })
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

      setList(activeRes);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });
    
    return () => unsub();
  }, [date, viewMode, isMounted]);

  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(getJSTDateString(d));
    cancelEdit();
  };

  const toMin = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const isOverlapping = () =>
    list.some(r => {
      if (r.id === editingId) return false;
      
      const rItem = r.selectedItem || r.room;
      if (rItem !== selectedItem) return false;

      const currentStart = toMin(start);
      const currentEnd = toMin(end);
      const targetStart = toMin(r.startTime);
      const targetEnd = toMin(r.endTime);

      return !(currentEnd <= targetStart || currentStart >= targetEnd);
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
    
    if (!isRecurring && isOverlapping()) return alert(`⚠️既に予約が入っています。`);

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
          const targetDateStr = getJSTDateString(baseDate);

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

  // クライアント側でマウントされるまでは何もレンダリングしない（ハイドレーションエラーを確実に防ぐ）
  if (!isMounted) return null;

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
                    {list.filter((r) => (r.selectedItem === itemName || r.room === itemName)).map((r) => {
                      const leftPos = ((toMin(r.startTime) - START_MIN) / TOTAL_MIN) * 100;
                      const widthVal = ((toMin(r.endTime) - toMin(r.startTime)) / TOTAL_MIN) * 100;
                      return (
                        <div key={r.id} onClick={() => startEdit(r)} style={{ ...barStyle, left: `${leftPos}%`, width: `${widthVal}%`, background: deptColors[r.department || r.dept] || "#6b7280", zIndex: 2, cursor: "pointer", border: editingId === r.id ? "3px solid #000" : "none" }}>
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
                            <span style={{...itemDeptBadge, background: deptColors[r.department || r.dept] || "#6b7280"}}>{(r.department || r.dept || "そ")[0]}</span>
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
