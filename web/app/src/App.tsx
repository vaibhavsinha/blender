import { useCallback } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { Toolbar } from "./components/Toolbar";
import { ViewportCanvas } from "./components/ViewportCanvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { StatusBar } from "./components/StatusBar";
import { useBlenderWasm } from "./hooks/useBlenderWasm";
import { useSceneStore } from "./store/sceneStore";
import { export3mf } from "./utils/export3mf";
import { extractSceneMeshes, extractFallbackCubeMesh } from "./utils/extractSceneMeshes";

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

  const handleAddPlane = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const idx = scene.addPlane(2.0);
    setObjectCount(scene.objectCount());
    setActiveObjectIndex(idx);
    setStatusMessage(`Added plane (Object ${idx})`);
  }, [sceneRef, setObjectCount, setActiveObjectIndex, setStatusMessage]);

  const handleShadeSmooth = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().setShadeSmooth(true);
    setStatusMessage("Shade Smooth");
  }, [sceneRef, setStatusMessage]);

  const handleShadeFlat = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().setShadeSmooth(false);
    setStatusMessage("Shade Flat");
  }, [sceneRef, setStatusMessage]);

  const handleInvertSelection = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().invertSelection();
    const mesh = obj.getMesh();
    setMeshStats(mesh.vertexCount(), mesh.faceCount(), mesh.selectedFaceCount());
    setStatusMessage("Selection inverted");
  }, [sceneRef, setMeshStats, setStatusMessage]);

  const handleMirrorX = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().scaleSelected(-1, 1, 1);
    setStatusMessage("Mirrored on X axis");
  }, [sceneRef, setStatusMessage]);

  const handleMirrorY = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().scaleSelected(1, -1, 1);
    setStatusMessage("Mirrored on Y axis");
  }, [sceneRef, setStatusMessage]);

  const handleMirrorZ = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().scaleSelected(1, 1, -1);
    setStatusMessage("Mirrored on Z axis");
  }, [sceneRef, setStatusMessage]);

  const handleDuplicate = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const idx = scene.duplicateActiveObject();
    setObjectCount(scene.objectCount());
    setActiveObjectIndex(idx);
    setStatusMessage("Object duplicated");
  }, [sceneRef, setObjectCount, setActiveObjectIndex, setStatusMessage]);

  const handleRecalcNormals = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().recalcNormals();
    setStatusMessage("Normals recalculated");
  }, [sceneRef, setStatusMessage]);

  const handleExport3mf = useCallback(async () => {
    setStatusMessage("Exporting 3MF...");
    try {
      const scene = sceneRef.current;
      const meshes =
        scene && scene.objectCount() > 0
          ? extractSceneMeshes(scene)
          : extractFallbackCubeMesh();
      await export3mf(meshes, "blender-web-lite.3mf");
      setStatusMessage(`Exported ${meshes.length} object(s) as 3MF`);
    } catch (err) {
      setStatusMessage(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }, [sceneRef, setStatusMessage]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <HeaderBar onExport3mf={handleExport3mf} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Toolbar
          onExtrude={handleExtrude}
          onSubdivide={handleSubdivide}
          onDelete={handleDelete}
          onToggleSelectAll={handleToggleSelectAll}
          onAddCube={handleAddCube}
          onAddPlane={handleAddPlane}
          onShadeSmooth={handleShadeSmooth}
          onShadeFlat={handleShadeFlat}
          onInvertSelection={handleInvertSelection}
          onMirrorX={handleMirrorX}
          onMirrorY={handleMirrorY}
          onMirrorZ={handleMirrorZ}
          onDuplicate={handleDuplicate}
          onRecalcNormals={handleRecalcNormals}
        />
        <ViewportCanvas sceneRef={sceneRef} />
        <PropertiesPanel />
      </div>
      <StatusBar />
    </div>
  );
}
