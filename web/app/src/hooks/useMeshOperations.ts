import { useCallback, useRef } from "react";
import type { Scene } from "../types/wasm";
import { useSceneStore } from "../store/sceneStore";

export function useMeshOperations(
  sceneRef: React.RefObject<Scene | null>,
  markDirty: () => void,
) {
  const grabActiveRef = useRef(false);
  const grabCumulativeRef = useRef({ dx: 0, dy: 0, dz: 0 });
  const rotateActiveRef = useRef(false);
  const rotateAngleCumulativeRef = useRef(0);
  const scaleActiveRef = useRef(false);
  const scaleCumulativeRef = useRef({ sx: 1, sy: 1, sz: 1 });
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

  const rotateSelected = useCallback(
    (ax: number, ay: number, az: number, angle: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      obj.getMesh().rotateSelected(ax, ay, az, angle);
      markDirty();
    },
    [sceneRef, markDirty],
  );

  const scaleSelected = useCallback(
    (sx: number, sy: number, sz: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      obj.getMesh().scaleSelected(sx, sy, sz);
      markDirty();
    },
    [sceneRef, markDirty],
  );

  const setShadeSmooth = useCallback(
    (smooth: boolean) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      obj.getMesh().setShadeSmooth(smooth);
      markDirty();
      setStatusMessage(smooth ? "Shade Smooth" : "Shade Flat");
    },
    [sceneRef, markDirty, setStatusMessage],
  );

  const invertSelection = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const obj = scene.getActiveObject();
    if (!obj) return;
    obj.getMesh().invertSelection();
    markDirty();
    updateStats();
    setStatusMessage("Selection inverted");
  }, [sceneRef, markDirty, updateStats, setStatusMessage]);

  const mirrorSelected = useCallback(
    (axis: "x" | "y" | "z") => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      const mesh = obj.getMesh();
      if (mesh.selectedFaceCount() === 0) {
        setStatusMessage("No faces selected for mirror");
        return;
      }
      const sx = axis === "x" ? -1 : 1;
      const sy = axis === "y" ? -1 : 1;
      const sz = axis === "z" ? -1 : 1;
      mesh.scaleSelected(sx, sy, sz);
      markDirty();
      setStatusMessage(`Mirrored on ${axis.toUpperCase()} axis`);
    },
    [sceneRef, markDirty, setStatusMessage],
  );

  /* ── Grab modal ── */

  const startGrab = useCallback((): boolean => {
    const scene = sceneRef.current;
    if (!scene) return false;
    const obj = scene.getActiveObject();
    if (!obj || obj.getMesh().selectedFaceCount() === 0) {
      setStatusMessage("No faces selected for grab");
      return false;
    }
    grabActiveRef.current = true;
    grabCumulativeRef.current = { dx: 0, dy: 0, dz: 0 };
    setStatusMessage("Grab: move mouse, click to confirm, Escape to cancel");
    return true;
  }, [sceneRef, setStatusMessage]);

  const endGrab = useCallback(
    (cancel: boolean) => {
      if (cancel) {
        const { dx, dy, dz } = grabCumulativeRef.current;
        translateSelected(-dx, -dy, -dz);
      }
      grabActiveRef.current = false;
      grabCumulativeRef.current = { dx: 0, dy: 0, dz: 0 };
      setStatusMessage("Ready");
      updateStats();
    },
    [translateSelected, updateStats, setStatusMessage],
  );

  /* ── Rotate modal ── */

  const startRotate = useCallback((): boolean => {
    const scene = sceneRef.current;
    if (!scene) return false;
    const obj = scene.getActiveObject();
    if (!obj || obj.getMesh().selectedFaceCount() === 0) {
      setStatusMessage("No faces selected for rotate");
      return false;
    }
    rotateActiveRef.current = true;
    rotateAngleCumulativeRef.current = 0;
    setStatusMessage("Rotate: move mouse, click to confirm, Escape to cancel");
    return true;
  }, [sceneRef, setStatusMessage]);

  const endRotate = useCallback(
    (cancel: boolean) => {
      if (cancel) {
        const totalAngle = rotateAngleCumulativeRef.current;
        rotateSelected(0, 1, 0, -totalAngle);
      }
      rotateActiveRef.current = false;
      rotateAngleCumulativeRef.current = 0;
      setStatusMessage("Ready");
      updateStats();
    },
    [rotateSelected, updateStats, setStatusMessage],
  );

  /* ── Scale modal ── */

  const startScale = useCallback((): boolean => {
    const scene = sceneRef.current;
    if (!scene) return false;
    const obj = scene.getActiveObject();
    if (!obj || obj.getMesh().selectedFaceCount() === 0) {
      setStatusMessage("No faces selected for scale");
      return false;
    }
    scaleActiveRef.current = true;
    scaleCumulativeRef.current = { sx: 1, sy: 1, sz: 1 };
    setStatusMessage("Scale: move mouse, click to confirm, Escape to cancel");
    return true;
  }, [sceneRef, setStatusMessage]);

  const endScale = useCallback(
    (cancel: boolean) => {
      if (cancel) {
        const { sx, sy, sz } = scaleCumulativeRef.current;
        if (sx !== 0 && sy !== 0 && sz !== 0) {
          scaleSelected(1 / sx, 1 / sy, 1 / sz);
        }
      }
      scaleActiveRef.current = false;
      scaleCumulativeRef.current = { sx: 1, sy: 1, sz: 1 };
      setStatusMessage("Ready");
      updateStats();
    },
    [scaleSelected, updateStats, setStatusMessage],
  );

  return {
    selectFace,
    toggleSelectAll,
    extrudeSelected,
    subdivideSelected,
    deleteSelected,
    translateSelected,
    rotateSelected,
    scaleSelected,
    setShadeSmooth,
    invertSelection,
    mirrorSelected,
    startGrab,
    endGrab,
    grabActiveRef,
    grabCumulativeRef,
    startRotate,
    endRotate,
    rotateActiveRef,
    rotateAngleCumulativeRef,
    startScale,
    endScale,
    scaleActiveRef,
    scaleCumulativeRef,
  };
}
