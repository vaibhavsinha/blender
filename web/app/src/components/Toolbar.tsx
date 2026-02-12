import { useSceneStore, type Tool } from "../store/sceneStore";

interface ToolbarProps {
  onExtrude: () => void;
  onSubdivide: () => void;
  onDelete: () => void;
  onToggleSelectAll: () => void;
  onAddCube: () => void;
}

export function Toolbar({
  onExtrude,
  onSubdivide,
  onDelete,
  onToggleSelectAll,
  onAddCube,
}: ToolbarProps) {
  const { activeTool, setActiveTool, mode } = useSceneStore();

  const tools: { key: Tool; label: string; shortcut: string }[] = [
    { key: "select", label: "Select", shortcut: "" },
    { key: "grab", label: "Grab", shortcut: "G" },
  ];

  return (
    <div
      style={{
        width: 48,
        background: "#2d2d2d",
        borderRight: "1px solid #1a1a1a",
        display: "flex",
        flexDirection: "column",
        padding: "8px 4px",
        gap: 4,
      }}
    >
      {tools.map((tool) => (
        <button
          key={tool.key}
          onClick={() => setActiveTool(tool.key)}
          title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
          style={{
            width: 40,
            height: 36,
            background: activeTool === tool.key ? "#4b6eaf" : "transparent",
            border: "1px solid " + (activeTool === tool.key ? "#6b8ec4" : "transparent"),
            borderRadius: 3,
            color: activeTool === tool.key ? "#fff" : "#999",
            cursor: "pointer",
            fontSize: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {tool.label}
        </button>
      ))}

      <div style={{ borderTop: "1px solid #444", margin: "4px 0" }} />

      {mode === "edit" && (
        <>
          <ToolBtn label="Sel All" shortcut="A" onClick={onToggleSelectAll} />
          <ToolBtn label="Extrude" shortcut="E" onClick={onExtrude} />
          <ToolBtn label="Subdiv" shortcut="W" onClick={onSubdivide} />
          <ToolBtn label="Delete" shortcut="X" onClick={onDelete} />
        </>
      )}

      <div style={{ borderTop: "1px solid #444", margin: "4px 0" }} />
      <ToolBtn label="+ Cube" shortcut="" onClick={onAddCube} />
    </div>
  );
}

function ToolBtn({
  label,
  shortcut,
  onClick,
}: {
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        width: 40,
        height: 32,
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 3,
        color: "#999",
        cursor: "pointer",
        fontSize: 9,
        padding: 2,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#3a3a3a";
        e.currentTarget.style.borderColor = "#555";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      {label}
    </button>
  );
}
