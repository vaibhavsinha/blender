import { useCallback } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { Toolbar } from "./components/Toolbar";
import { ViewportCanvas } from "./components/ViewportCanvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { StatusBar } from "./components/StatusBar";
import { useBlenderWasm } from "./hooks/useBlenderWasm";
import { useSceneStore } from "./store/sceneStore";

export default function App() {
  const { scene: sceneRef } = useBlenderWasm();
  const { setObjectCount, setActiveObjectIndex, setStatusMessage, setMeshStats } =
    useSceneStore();

  const handleExtrude = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    const mesh = obj.getMesh();
    if (mesh.selectedFaceCount() === 0) {
      setStatusMessage("Select faces first (click or press A)");
      return;
    }
    mesh.extrudeSelectedFaces(0.5);
    setMeshStats(mesh.vertexCount(), mesh.faceCount(), mesh.selectedFaceCount());
    setStatusMessage("Extruded faces");
  }, [sceneRef, setStatusMessage, setMeshStats]);

  const handleSubdivide = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    const mesh = obj.getMesh();
    if (mesh.selectedFaceCount() === 0) {
      setStatusMessage("Select faces first");
      return;
    }
    mesh.subdivideSelectedFaces();
    setMeshStats(mesh.vertexCount(), mesh.faceCount(), mesh.selectedFaceCount());
    setStatusMessage("Subdivided faces");
  }, [sceneRef, setStatusMessage, setMeshStats]);

  const handleDelete = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    const mesh = obj.getMesh();
    mesh.deleteSelectedFaces();
    setMeshStats(mesh.vertexCount(), mesh.faceCount(), mesh.selectedFaceCount());
    setStatusMessage("Deleted faces");
  }, [sceneRef, setStatusMessage, setMeshStats]);

  const handleToggleSelectAll = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    const mesh = obj.getMesh();
    mesh.toggleSelectAll();
    setMeshStats(mesh.vertexCount(), mesh.faceCount(), mesh.selectedFaceCount());
  }, [sceneRef, setMeshStats]);

  const handleAddCube = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const idx = scene.addCube(2.0);
    setObjectCount(scene.objectCount());
    setActiveObjectIndex(idx);
    setStatusMessage(`Added cube (Object ${idx})`);
  }, [sceneRef, setObjectCount, setActiveObjectIndex, setStatusMessage]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <HeaderBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Toolbar
          onExtrude={handleExtrude}
          onSubdivide={handleSubdivide}
          onDelete={handleDelete}
          onToggleSelectAll={handleToggleSelectAll}
          onAddCube={handleAddCube}
        />
        <ViewportCanvas sceneRef={sceneRef} />
        <PropertiesPanel />
      </div>
      <StatusBar />
    </div>
  );
}
