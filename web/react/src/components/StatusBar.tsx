import { useSceneStore } from "../store/sceneStore";

export function StatusBar() {
  const { fps, statusMessage, wasmReady, vertexCount, faceCount } = useSceneStore();

  return (
    <div
      style={{
        height: 24,
        background: "#2d2d2d",
        borderTop: "1px solid #1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontSize: 11,
        color: "#999",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", gap: 16 }}>
        <span>{statusMessage}</span>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <span>
          Verts: {vertexCount} | Faces: {faceCount}
        </span>
        <span style={{ color: fps > 50 ? "#6a6" : fps > 30 ? "#aa6" : "#a66" }}>
          {fps} FPS
        </span>
        <span
          style={{
            color: wasmReady ? "#6a6" : "#a66",
          }}
        >
          {wasmReady ? "WASM" : "JS Fallback"}
        </span>
      </div>
    </div>
  );
}
