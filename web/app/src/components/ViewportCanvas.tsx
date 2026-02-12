import { useRef, useEffect, useCallback, useState } from "react";
import type { Scene } from "../types/wasm";
import type { Tool } from "../store/sceneStore";
import { useViewport } from "../hooks/useViewport";
import { useMeshOperations } from "../hooks/useMeshOperations";
import { useSceneStore } from "../store/sceneStore";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { MeasureOverlay } from "./MeasureOverlay";

const TOOL_CURSORS: Record<Tool, string> = {
  select: "default",
  grab: "move",
  rotate: "grab",
  scale: "ew-resize",
  annotate: "crosshair",
  measure: "crosshair",
};

interface ViewportCanvasProps {
  sceneRef: React.RefObject<Scene | null>;
}

export function ViewportCanvas({ sceneRef }: ViewportCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport(canvasRef, sceneRef);
  const meshOps = useMeshOperations(sceneRef, viewport.markDirty);
  const { mode, activeTool, setActiveTool, setStatusMessage } = useSceneStore();

  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });

  // Track mouse state
  const isDraggingRef = useRef(false);
  const mouseButtonRef = useRef(-1);
  const shiftKeyRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);
  const CLICK_THRESHOLD = 4; // px — below this is a click, above is a drag

  // Cursor state — derived from active tool + modal overrides
  const [cursor, setCursor] = useState("default");

  const updateCursor = useCallback(() => {
    if (meshOps.grabActiveRef.current) {
      setCursor("grabbing");
    } else if (meshOps.rotateActiveRef.current) {
      setCursor("grabbing");
    } else if (meshOps.scaleActiveRef.current) {
      setCursor("col-resize");
    } else {
      setCursor(TOOL_CURSORS[activeTool] || "default");
    }
  }, [activeTool]); // meshOps refs are stable — only activeTool is reactive

  useEffect(() => {
    updateCursor();
  }, [activeTool, updateCursor]);

  // Track overlay size — seed synchronously to avoid 0x0 initial render
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    setOverlaySize({ width: rect.width, height: rect.height });
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setOverlaySize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Cancel active modals when tool changes externally (e.g. toolbar click)
  useEffect(() => {
    if (meshOps.grabActiveRef.current && activeTool !== "grab") {
      meshOps.endGrab(true);
    }
    if (meshOps.rotateActiveRef.current && activeTool !== "rotate") {
      meshOps.endRotate(true);
    }
    if (meshOps.scaleActiveRef.current && activeTool !== "scale") {
      meshOps.endScale(true);
    }
    updateCursor();
  }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize WebGL on mount
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

      // If in a modal mode, click to confirm
      if (meshOps.grabActiveRef.current) {
        meshOps.endGrab(false);
        updateCursor();
        return;
      }
      if (meshOps.rotateActiveRef.current) {
        meshOps.endRotate(false);
        updateCursor();
        return;
      }
      if (meshOps.scaleActiveRef.current) {
        meshOps.endScale(false);
        updateCursor();
        return;
      }
    },
    [meshOps, updateCursor],
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
        const tdx = dx * 0.01;
        const tdy = -dy * 0.01;
        meshOps.translateSelected(tdx, tdy, 0);
        meshOps.grabCumulativeRef.current.dx += tdx;
        meshOps.grabCumulativeRef.current.dy += tdy;
        return;
      }

      // Rotate mode: rotate around Y axis
      if (meshOps.rotateActiveRef.current) {
        const angle = dx * 0.01;
        meshOps.rotateSelected(0, 1, 0, angle);
        meshOps.rotateAngleCumulativeRef.current += angle;
        return;
      }

      // Scale mode: uniform scale
      if (meshOps.scaleActiveRef.current) {
        const factor = 1 + dx * 0.005;
        meshOps.scaleSelected(factor, factor, factor);
        meshOps.scaleCumulativeRef.current *= factor;
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
          if (
            !meshOps.grabActiveRef.current &&
            !meshOps.rotateActiveRef.current &&
            !meshOps.scaleActiveRef.current
          ) {
            if (meshOps.startGrab()) {
              setActiveTool("grab");
              updateCursor();
            }
          }
          break;
        case "r":
          if (
            !meshOps.grabActiveRef.current &&
            !meshOps.rotateActiveRef.current &&
            !meshOps.scaleActiveRef.current
          ) {
            if (meshOps.startRotate()) {
              setActiveTool("rotate");
              updateCursor();
            }
          }
          break;
        case "s":
          if (
            !meshOps.grabActiveRef.current &&
            !meshOps.rotateActiveRef.current &&
            !meshOps.scaleActiveRef.current
          ) {
            if (meshOps.startScale()) {
              setActiveTool("scale");
              updateCursor();
            }
          }
          break;
        case "escape":
          if (meshOps.grabActiveRef.current) {
            meshOps.endGrab(true);
          } else if (meshOps.rotateActiveRef.current) {
            meshOps.endRotate(true);
          } else if (meshOps.scaleActiveRef.current) {
            meshOps.endScale(true);
          }
          // Don't reset tool when annotate/measure is active — let their own Escape handlers run
          if (activeTool !== "annotate" && activeTool !== "measure") {
            setActiveTool("select");
          }
          updateCursor();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, meshOps, setActiveTool, setStatusMessage, updateCursor]);

  return (
    <div
      ref={wrapperRef}
      style={{ flex: 1, position: "relative", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor,
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
      <AnnotationOverlay
        active={activeTool === "annotate"}
        width={overlaySize.width}
        height={overlaySize.height}
      />
      <MeasureOverlay
        active={activeTool === "measure"}
        width={overlaySize.width}
        height={overlaySize.height}
      />
    </div>
  );
}
