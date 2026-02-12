import { useSceneStore, type Tool } from "../store/sceneStore";

interface ToolbarProps {
  onExtrude: () => void;
  onSubdivide: () => void;
  onDelete: () => void;
  onToggleSelectAll: () => void;
  onAddCube: () => void;
}

/* ── SVG Icons (matching Blender's left toolbar) ── */

function CursorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M5 2L5 15L8.5 11.5L12 17L14 16L10.5 10L15 10L5 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Vertical arrow */}
      <line x1="10" y1="2" x2="10" y2="18" />
      <polyline points="7,5 10,2 13,5" />
      <polyline points="7,15 10,18 13,15" />
      {/* Horizontal arrow */}
      <line x1="2" y1="10" x2="18" y2="10" />
      <polyline points="5,7 2,10 5,13" />
      <polyline points="15,7 18,10 15,13" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 3.5A7 7 0 1 0 17 10" />
      <polyline points="14.5,3.5 17.5,3.5 17.5,6.5" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Top-right arrow */}
      <line x1="6" y1="14" x2="15" y2="5" />
      <polyline points="10,5 15,5 15,10" />
      {/* Bottom-left arrow */}
      <line x1="14" y1="6" x2="5" y2="15" />
      <polyline points="10,15 5,15 5,10" />
    </svg>
  );
}

function ExtrudeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {/* Base face */}
      <rect x="4" y="11" width="8" height="6" rx="0.5" />
      {/* Extruded face */}
      <rect x="6" y="3" width="8" height="6" rx="0.5" />
      {/* Connecting edges */}
      <line x1="4" y1="11" x2="6" y2="9" />
      <line x1="12" y1="11" x2="14" y2="9" />
    </svg>
  );
}

function SubdivideIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {/* Outer square */}
      <rect x="3" y="3" width="14" height="14" rx="0.5" />
      {/* Cross dividers */}
      <line x1="10" y1="3" x2="10" y2="17" />
      <line x1="3" y1="10" x2="17" y2="10" />
      {/* Center dots */}
      <circle cx="10" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  );
}

function SelectAllIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {/* Dashed selection box */}
      <rect x="3" y="3" width="14" height="14" rx="1" strokeDasharray="3 2" />
      {/* Dots at corners */}
      <circle cx="3" cy="3" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="3" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="3" cy="17" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AddCubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {/* Cube front face */}
      <path d="M4 7L10 4L16 7L16 14L10 17L4 14Z" />
      <line x1="10" y1="4" x2="10" y2="17" />
      <line x1="4" y1="7" x2="10" y2="10" />
      <line x1="16" y1="7" x2="10" y2="10" />
      {/* Plus sign */}
      <line x1="15" y1="1" x2="15" y2="6" strokeWidth="1.6" />
      <line x1="12.5" y1="3.5" x2="17.5" y2="3.5" strokeWidth="1.6" />
    </svg>
  );
}

function AnnotateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17L4 12L14 2L18 6L8 16L3 17Z" />
      <line x1="12" y1="4" x2="16" y2="8" />
    </svg>
  );
}

function MeasureIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {/* Ruler body */}
      <path d="M2 14L14 2L18 6L6 18Z" />
      {/* Tick marks */}
      <line x1="6" y1="6" x2="8" y2="8" />
      <line x1="9" y1="3" x2="10.5" y2="4.5" />
      <line x1="12.5" y1="5.5" x2="14" y2="7" />
    </svg>
  );
}

/* ── Toolbar Component ── */

export function Toolbar({
  onExtrude,
  onSubdivide,
  onDelete,
  onToggleSelectAll,
  onAddCube,
}: ToolbarProps) {
  const { activeTool, setActiveTool, mode } = useSceneStore();

  const tools: { key: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { key: "select", icon: <CursorIcon />, label: "Select Box", shortcut: "" },
    { key: "grab", icon: <MoveIcon />, label: "Move", shortcut: "G" },
    { key: "rotate", icon: <RotateIcon />, label: "Rotate", shortcut: "R" },
    { key: "scale", icon: <ScaleIcon />, label: "Scale", shortcut: "S" },
  ];

  return (
    <div
      style={{
        width: 44,
        background: "#303030",
        borderRight: "1px solid #1a1a1a",
        display: "flex",
        flexDirection: "column",
        padding: "4px 2px",
        gap: 1,
      }}
    >
      {/* Main tools */}
      {tools.map((tool) => (
        <ToolIconBtn
          key={tool.key}
          icon={tool.icon}
          label={tool.label}
          shortcut={tool.shortcut}
          active={activeTool === tool.key}
          onClick={() => setActiveTool(tool.key)}
        />
      ))}

      <Divider />

      <ToolIconBtn
        icon={<AnnotateIcon />}
        label="Annotate"
        shortcut=""
        active={activeTool === "annotate"}
        onClick={() => setActiveTool("annotate")}
      />
      <ToolIconBtn
        icon={<MeasureIcon />}
        label="Measure"
        shortcut=""
        active={activeTool === "measure"}
        onClick={() => setActiveTool("measure")}
      />

      <Divider />

      <ToolIconBtn icon={<AddCubeIcon />} label="Add Cube" shortcut="" onClick={onAddCube} />

      {/* Edit mode tools */}
      {mode === "edit" && (
        <>
          <Divider />
          <ToolIconBtn icon={<SelectAllIcon />} label="Select All" shortcut="A" onClick={onToggleSelectAll} />
          <ToolIconBtn icon={<ExtrudeIcon />} label="Extrude" shortcut="E" onClick={onExtrude} />
          <ToolIconBtn icon={<SubdivideIcon />} label="Subdivide" shortcut="W" onClick={onSubdivide} />
          <ToolIconBtn icon={<DeleteIcon />} label="Delete" shortcut="X" onClick={onDelete} />
        </>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #484848", margin: "3px 4px" }} />;
}

function ToolIconBtn({
  icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        width: 40,
        height: 36,
        background: active ? "#4b6eaf" : "transparent",
        border: "none",
        borderRadius: 4,
        color: active ? "#fff" : "#b0b0b0",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#404040";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {icon}
    </button>
  );
}
