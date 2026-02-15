import { useSceneStore } from "../store/sceneStore";

interface HeaderBarProps {
  onExport3mf?: () => void;
}

export function HeaderBar({ onExport3mf }: HeaderBarProps) {
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
      <div style={{ flex: 1 }} />
      {onExport3mf && (
        <button
          onClick={onExport3mf}
          title="Export 3MF"
          style={{
            background: "#3a7d44",
            border: "1px solid #4a9d54",
            borderRadius: 3,
            color: "#fff",
            padding: "2px 10px",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export 3MF
        </button>
      )}
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
