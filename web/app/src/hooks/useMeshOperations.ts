import { useCallback, useRef } from "react";
import type { Scene } from "../types/wasm";
import { useSceneStore } from "../store/sceneStore";

export function useMeshOperations(
  sceneRef: React.RefObject<Scene | null>,
  markDirty: () => void,
) {
  const grabActiveRef = useRef(false);
  const { setMeshStats, setStatusMessage } = useSceneStore();

  const updateStats = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    const mesh = obj.getMesh();
    setMeshStats(mesh.vertexCount(), mesh.faceCount(), mesh.selectedFaceCount());
  }, [sceneRef, setMeshStats]);

  const selectFace = useCallback(
    (faceIndex: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      const mesh = obj.getMesh();
      mesh.deselectAll();
      mesh.selectFace(faceIndex);
      markDirty();
      updateStats();
      setStatusMessage(`Face ${faceIndex} selected`);
    },
    [sceneRef, markDirty, updateStats, setStatusMessage],
  );

  const toggleSelectAll = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().toggleSelectAll();
    markDirty();
    updateStats();
  }, [sceneRef, markDirty, updateStats]);

  const extrudeSelected = useCallback(
    (distance: number = 0.5) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      const mesh = obj.getMesh();
      if (mesh.selectedFaceCount() === 0) {
        setStatusMessage("No faces selected for extrude");
        return;
      }
      mesh.extrudeSelectedFaces(distance);
      markDirty();
      updateStats();
      setStatusMessage(`Extruded ${mesh.selectedFaceCount()} faces`);
    },
    [sceneRef, markDirty, updateStats, setStatusMessage],
  );

  const subdivideSelected = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    const mesh = obj.getMesh();
    if (mesh.selectedFaceCount() === 0) {
      setStatusMessage("No faces selected for subdivide");
      return;
    }
    mesh.subdivideSelectedFaces();
    markDirty();
    updateStats();
    setStatusMessage("Subdivided selected faces");
  }, [sceneRef, markDirty, updateStats, setStatusMessage]);

  const deleteSelected = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    const mesh = obj.getMesh();
    if (mesh.selectedFaceCount() === 0) {
      setStatusMessage("No faces selected for delete");
      return;
    }
    mesh.deleteSelectedFaces();
    markDirty();
    updateStats();
    setStatusMessage("Deleted selected faces");
  }, [sceneRef, markDirty, updateStats, setStatusMessage]);

  const translateSelected = useCallback(
    (dx: number, dy: number, dz: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      obj.getMesh().translateSelected(dx, dy, dz);
      markDirty();
    },
    [sceneRef, markDirty],
  );

  const startGrab = useCallback(() => {
    grabActiveRef.current = true;
    setStatusMessage("Grab: move mouse, click to confirm");
  }, [setStatusMessage]);

  const endGrab = useCallback(() => {
    grabActiveRef.current = false;
    setStatusMessage("Ready");
    updateStats();
  }, [updateStats, setStatusMessage]);

  return {
    selectFace,
    toggleSelectAll,
    extrudeSelected,
    subdivideSelected,
    deleteSelected,
    translateSelected,
    startGrab,
    endGrab,
    grabActiveRef,
  };
}
