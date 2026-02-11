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
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Initialize WebGL on mount
  useEffect(() => {
    viewport.init();
    viewport.markDirty();
    viewport.startRenderLoop();
    return () => viewport.stopRenderLoop();
  }, [viewport]);

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      mouseButtonRef.current = e.button;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      // If in grab mode, click to confirm
      if (meshOps.grabActiveRef.current) {
        meshOps.endGrab();
        return;
      }

      // Left click: face selection (in edit mode)
      if (e.button === 0 && mode === "edit" && activeTool === "select") {
        const scene = sceneRef.current;
        if (scene) {
          const obj = scene.getActiveObject();
          if (obj) {
            const mesh = obj.getMesh();
            const faceCount = mesh.faceCount();
            if (faceCount > 0) {
              // Simple face picking: cycle through faces on click
              // (ray-casting would require more math; this is a hackathon)
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      // Grab mode: translate selected faces
      if (meshOps.grabActiveRef.current) {
        meshOps.translateSelected(dx * 0.01, -dy * 0.01, 0);
        return;
      }

      if (!isDraggingRef.current) return;

      if (mouseButtonRef.current === 1) {
        // Middle button: orbit
        viewport.handleOrbit(-dx * 0.005, -dy * 0.005);
      } else if (mouseButtonRef.current === 2) {
        // Right button: pan
        viewport.handlePan(dx, dy);
      }
    },
    [viewport, meshOps],
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    mouseButtonRef.current = -1;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      viewport.handleZoom(-e.deltaY * 0.003);
    },
    [viewport],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

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
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    />
  );
}
