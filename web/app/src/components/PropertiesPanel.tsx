import { useSceneStore } from "../store/sceneStore";

export function PropertiesPanel() {
  const { vertexCount, faceCount, selectedFaceCount, objectCount, activeObjectIndex, mode } =
    useSceneStore();

  return (
    <div
      style={{
        width: 220,
        background: "#2d2d2d",
        borderLeft: "1px solid #1a1a1a",
        padding: 12,
        fontSize: 12,
        overflow: "auto",
      }}
    >
      <Section title="Scene">
        <Row label="Objects" value={objectCount} />
        <Row label="Active" value={activeObjectIndex >= 0 ? `Object ${activeObjectIndex}` : "None"} />
        <Row label="Mode" value={mode === "edit" ? "Edit Mode" : "Object Mode"} />
      </Section>

      <Section title="Mesh">
        <Row label="Vertices" value={vertexCount} />
        <Row label="Faces" value={faceCount} />
        <Row label="Selected" value={selectedFaceCount} />
      </Section>

      <Section title="Shortcuts">
        <ShortcutRow keys="MMB drag" action="Orbit" />
        <ShortcutRow keys="Scroll" action="Zoom" />
        <ShortcutRow keys="RMB drag" action="Pan" />
        <ShortcutRow keys="A" action="Select All" />
        <ShortcutRow keys="E" action="Extrude" />
        <ShortcutRow keys="W" action="Subdivide" />
        <ShortcutRow keys="X" action="Delete" />
        <ShortcutRow keys="G" action="Grab" />
        <ShortcutRow keys="Numpad ." action="Focus" />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#888",
          textTransform: "uppercase",
          marginBottom: 6,
          borderBottom: "1px solid #444",
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span style={{ color: "#999" }}>{label}</span>
      <span style={{ color: "#ddd" }}>{value}</span>
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span
        style={{
          background: "#383838",
          padding: "1px 4px",
          borderRadius: 2,
          fontSize: 10,
          color: "#bbb",
        }}
      >
        {keys}
      </span>
      <span style={{ color: "#999", fontSize: 11 }}>{action}</span>
    </div>
  );
}
