export default function App() {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "64px" }}>会議室予約</h1>

      <input
        placeholder="名前"
        style={{
          width: "100%",
          height: "120px",
          fontSize: "48px",
          marginTop: "20px",
        }}
      />

      <select
        style={{
          width: "100%",
          height: "120px",
          fontSize: "48px",
          marginTop: "20px",
        }}
      >
        <option>1階食堂</option>
        <option>2階会議室①</option>
        <option>2階会議室②</option>
        <option>3階応接室</option>
      </select>

      <button
        style={{
          width: "100%",
          height: "140px",
          fontSize: "56px",
          marginTop: "30px",
        }}
      >
        予約する
      </button>
    </div>
  );
}
