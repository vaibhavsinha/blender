import { useRef, useEffect, useCallback } from "react";
import type { Scene } from "../types/wasm";
import { useViewport } from "../hooks/useViewport";
import { useMeshOperations } from "../hooks/useMeshOperations";
import { useSceneStore } from "../store/sceneStore";

interface ViewportCanvasProps {
  sceneRef: React.RefObject<Scene | null>;
}

export function ViewportCanvas({ sceneRef }: ViewportCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewport = useViewport(canvasRef, sceneRef);
  const meshOps = useMeshOperations(sceneRef, viewport.markDirty);
  const { mode, activeTool, setActiveTool, setStatusMessage } = useSceneStore();

  // Track mouse state
  const isDraggingRef = useRef(false);
  const mouseButtonRef = useRef(-1);
  const shiftKeyRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);
  const CLICK_THRESHOLD = 4; // px — below this is a click, above is a drag

  // Initialize WebGL on mount (use stable refs to avoid re-init on every render)
  useEffect(() => {
    viewport.init();
    viewport.markDirty();
    viewport.startRenderLoop();
    return () => viewport.stopRenderLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.init, viewport.startRenderLoop, viewport.stopRenderLoop]);

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      mouseButtonRef.current = e.button;
      shiftKeyRef.current = e.shiftKey;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      dragDistanceRef.current = 0;

      // If in grab mode, click to confirm
      if (meshOps.grabActiveRef.current) {
        meshOps.endGrab();
        return;
      }
    },
    [meshOps],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      shiftKeyRef.current = e.shiftKey;

      // Track total drag distance from mousedown position
      const totalDx = e.clientX - mouseDownPosRef.current.x;
      const totalDy = e.clientY - mouseDownPosRef.current.y;
      dragDistanceRef.current = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

      // Grab mode: translate selected faces
      if (meshOps.grabActiveRef.current) {
        meshOps.translateSelected(dx * 0.01, -dy * 0.01, 0);
        return;
      }

      if (!isDraggingRef.current) return;

      if (mouseButtonRef.current === 0) {
        // Left button: orbit (or pan if shift held)
        if (e.shiftKey) {
          viewport.handlePan(dx, dy);
        } else {
          viewport.handleOrbit(-dx * 0.005, -dy * 0.005);
        }
      } else if (mouseButtonRef.current === 1) {
        // Middle button: orbit
        viewport.handleOrbit(-dx * 0.005, -dy * 0.005);
      } else if (mouseButtonRef.current === 2) {
        // Right button: pan
        viewport.handlePan(dx, dy);
      }
    },
    [viewport, meshOps],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const wasClick =
        dragDistanceRef.current < CLICK_THRESHOLD &&
        mouseButtonRef.current === 0;

      isDraggingRef.current = false;
      mouseButtonRef.current = -1;

      // Left click (not drag): face selection in edit mode
      if (wasClick && mode === "edit" && activeTool === "select") {
        const scene = sceneRef.current;
        if (scene) {
          const obj = scene.getActiveObject();
          if (obj) {
            const mesh = obj.getMesh();
            const faceCount = mesh.faceCount();
            if (faceCount > 0) {
              const currentSelected = mesh.selectedFaceCount();
              let nextFace = 0;
              for (let i = 0; i < faceCount; i++) {
                if (mesh.isFaceSelected(i)) {
                  nextFace = (i + 1) % faceCount;
                  break;
                }
              }
              if (currentSelected === 0) {
                nextFace = 0;
              }
              meshOps.selectFace(nextFace);
            }
          }
        }
      }
    },
    [mode, activeTool, sceneRef, meshOps],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Use native wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      viewport.handleZoom(-e.deltaY * 0.003);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [viewport.handleZoom]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "a":
          meshOps.toggleSelectAll();
          break;
        case "e":
          meshOps.extrudeSelected(0.5);
          break;
        case "w":
          meshOps.subdivideSelected();
          break;
        case "x":
        case "delete":
          meshOps.deleteSelected();
          break;
        case "g":
          if (!meshOps.grabActiveRef.current) {
            setActiveTool("grab");
            meshOps.startGrab();
          }
          break;
        case "escape":
          if (meshOps.grabActiveRef.current) {
            meshOps.endGrab();
          }
          setActiveTool("select");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [meshOps, setActiveTool, setStatusMessage]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        flex: 1,
        display: "block",
        cursor: meshOps.grabActiveRef.current ? "move" : "default",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        isDraggingRef.current = false;
        mouseButtonRef.current = -1;
      }}
      onContextMenu={handleContextMenu}
    />
  );
}
