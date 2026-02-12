import { useSceneStore } from "../store/sceneStore";

export function HeaderBar() {
  const { mode, setMode } = useSceneStore();

  return (
    <div
      style={{
        height: 32,
        background: "#2d2d2d",
        borderBottom: "1px solid #1a1a1a",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
        fontSize: 13,
        userSelect: "none",
      }}
    >
      <span style={{ fontWeight: 600, color: "#e88a36", marginRight: 12 }}>
        Blender Web Lite
      </span>
      <button
        onClick={() => setMode("object")}
        style={modeButtonStyle(mode === "object")}
      >
        Object Mode
      </button>
      <button
        onClick={() => setMode("edit")}
        style={modeButtonStyle(mode === "edit")}
      >
        Edit Mode
      </button>
    </div>
  );
}

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "#4b6eaf" : "transparent",
    border: "1px solid " + (active ? "#6b8ec4" : "#555"),
    borderRadius: 3,
    color: active ? "#fff" : "#aaa",
    padding: "2px 10px",
    cursor: "pointer",
    fontSize: 12,
  };
}
