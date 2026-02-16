import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { Scene } from "../types/wasm";
import type { Tool } from "../store/sceneStore";
import { useViewport } from "../hooks/useViewport";
import { useMeshOperations } from "../hooks/useMeshOperations";
import { useSceneStore } from "../store/sceneStore";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { MeasureOverlay } from "./MeasureOverlay";
import { ContextMenu, type MenuItem } from "./ContextMenu";

const TOOL_CURSORS: Record<Tool, string> = {
  select: "default",
  grab: "move",
  rotate: "grab",
  scale: "default",
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [renameInput, setRenameInput] = useState<{ x: number; y: number; value: string } | null>(null);

  // Scale gizmo axis constraint
  const scaleAxisRef = useRef<"x" | "y" | "z" | "uniform" | null>(null);

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
      setCursor("default");
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
      scaleAxisRef.current = null;
      viewport.scaleAxisRef.current = null;
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

  // Scene-level operations
  const duplicateObject = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.duplicateActiveObject();
    viewport.markDirty();
    setStatusMessage("Object duplicated");
  }, [sceneRef, viewport, setStatusMessage]);

  const removeObject = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const idx = scene.activeObjectIndex;
    if (idx < 0) return;
    scene.removeObject(idx);
    viewport.markDirty();
    setStatusMessage("Object deleted");
  }, [sceneRef, viewport, setStatusMessage]);

  const renameObject = useCallback(
    (name: string) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      obj.setName(name);
      setStatusMessage(`Renamed to "${name}"`);
    },
    [sceneRef, setStatusMessage],
  );

  const startRename = useCallback(
    (x: number, y: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const obj = scene.getActiveObject();
      if (!obj) return;
      setRenameInput({ x, y, value: obj.getName() });
    },
    [sceneRef],
  );

  const getGizmoCenter = useCallback((): [number, number, number] => {
    const scene = sceneRef.current;
    if (scene) {
      const obj = scene.getActiveObject();
      if (obj) {
        const loc = obj.getLocation();
        return [loc[0], loc[1], loc[2]];
      }
    }
    return [0, 0, 0];
  }, [sceneRef]);

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      mouseButtonRef.current = e.button;
      shiftKeyRef.current = e.shiftKey;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      dragDistanceRef.current = 0;

      // If in a modal mode, click to confirm.
      // Clear isDragging so the confirmation click doesn't leak into orbit.
      if (meshOps.grabActiveRef.current) {
        isDraggingRef.current = false;
        meshOps.endGrab(false);
        updateCursor();
        return;
      }
      if (meshOps.rotateActiveRef.current) {
        isDraggingRef.current = false;
        meshOps.endRotate(false);
        updateCursor();
        return;
      }
      if (meshOps.scaleActiveRef.current) {
        isDraggingRef.current = false;
        meshOps.endScale(false);
        scaleAxisRef.current = null;
        viewport.scaleAxisRef.current = null;
        updateCursor();
        return;
      }

      // When scale tool active and no modal running, check for gizmo handle click
      // If no specific axis handle is hit, default to uniform scaling
      if (activeTool === "scale" && e.button === 0) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const hitAxis = viewport.getGizmoHitInfo(
            e.clientX - rect.left, e.clientY - rect.top,
            rect.width, rect.height, getGizmoCenter(),
          ) ?? "uniform";
          if (meshOps.startScale()) {
            scaleAxisRef.current = hitAxis;
            viewport.scaleAxisRef.current = hitAxis;
            updateCursor();
            setStatusMessage(`Scale ${hitAxis === "uniform" ? "uniform" : hitAxis.toUpperCase()}: move mouse, click to confirm`);
            return;
          }
        }
      }
    },
    [meshOps, updateCursor, activeTool, viewport, getGizmoCenter, setStatusMessage],
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

      // Scale mode: per-axis or uniform
      if (meshOps.scaleActiveRef.current) {
        const axis = scaleAxisRef.current;
        let factor: number;
        if (axis === "y") {
          factor = 1 - dy * 0.005; // vertical: drag up = scale up (screen Y inverted)
        } else {
          factor = 1 + dx * 0.005; // X, Z, and uniform: horizontal
        }
        let sx = 1, sy = 1, sz = 1;
        if (axis === "x") sx = factor;
        else if (axis === "y") sy = factor;
        else if (axis === "z") sz = factor;
        else { sx = factor; sy = factor; sz = factor; }
        meshOps.scaleSelected(sx, sy, sz);
        meshOps.scaleCumulativeRef.current.sx *= sx;
        meshOps.scaleCumulativeRef.current.sy *= sy;
        meshOps.scaleCumulativeRef.current.sz *= sz;
        // Status feedback
        const cum = meshOps.scaleCumulativeRef.current;
        if (axis && axis !== "uniform") {
          setStatusMessage(`Scale ${axis.toUpperCase()}: ${cum[axis === "x" ? "sx" : axis === "y" ? "sy" : "sz"].toFixed(3)}`);
        } else {
          setStatusMessage(`Scale: ${cum.sx.toFixed(3)}`);
        }
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
    [viewport, meshOps, setStatusMessage],
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
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Build context menu items based on mode
  const contextMenuItems: MenuItem[] = useMemo(() => {
    const mirrorSubmenu: MenuItem = {
      type: "submenu",
      label: "Mirror",
      children: [
        { type: "action", label: "X", onClick: () => meshOps.mirrorSelected("x") },
        { type: "action", label: "Y", onClick: () => meshOps.mirrorSelected("y") },
        { type: "action", label: "Z", onClick: () => meshOps.mirrorSelected("z") },
      ],
    };

    if (mode === "object") {
      return [
        { type: "action", label: "Shade Smooth", onClick: () => meshOps.setShadeSmooth(true) },
        { type: "action", label: "Shade Flat", onClick: () => meshOps.setShadeSmooth(false) },
        { type: "separator" },
        { type: "action", label: "Duplicate Objects", shortcut: "Shift+D", onClick: duplicateObject },
        {
          type: "action",
          label: "Rename Active Object...",
          shortcut: "F2",
          onClick: () => {
            if (contextMenu) startRename(contextMenu.x, contextMenu.y);
          },
        },
        { type: "separator" },
        mirrorSubmenu,
        { type: "separator" },
        { type: "action", label: "Delete", shortcut: "X", onClick: removeObject },
      ];
    }

    // Edit mode
    return [
      { type: "action", label: "Extrude Faces", shortcut: "E", onClick: () => meshOps.extrudeSelected(0.5) },
      { type: "action", label: "Subdivide", shortcut: "W", onClick: () => meshOps.subdivideSelected() },
      { type: "separator" },
      { type: "action", label: "Select All", shortcut: "A", onClick: () => meshOps.toggleSelectAll() },
      {
        type: "action",
        label: "Deselect All",
        onClick: () => {
          const scene = sceneRef.current;
          if (scene) {
            const obj = scene.getActiveObject();
            if (obj) {
              obj.getMesh().deselectAll();
              viewport.markDirty();
            }
          }
        },
      },
      { type: "action", label: "Invert Selection", onClick: () => meshOps.invertSelection() },
      { type: "separator" },
      { type: "action", label: "Shade Smooth", onClick: () => meshOps.setShadeSmooth(true) },
      { type: "action", label: "Shade Flat", onClick: () => meshOps.setShadeSmooth(false) },
      { type: "separator" },
      mirrorSubmenu,
      { type: "separator" },
      { type: "action", label: "Delete Faces", shortcut: "X", onClick: () => meshOps.deleteSelected() },
    ];
  }, [mode, meshOps, duplicateObject, removeObject, startRename, contextMenu, sceneRef, viewport]);

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

      // Close context menu on any key
      if (contextMenu) {
        setContextMenu(null);
      }

      switch (e.key) {
        case "F2":
          e.preventDefault();
          startRename(window.innerWidth / 2, window.innerHeight / 2);
          return;
        case "D":
        case "d":
          if (e.shiftKey && mode === "object") {
            e.preventDefault();
            duplicateObject();
            return;
          }
          break;
      }

      // Axis constraint keys during active scale modal
      if (meshOps.scaleActiveRef.current) {
        const k = e.key.toLowerCase();
        if (k === "x" || k === "y" || k === "z") {
          scaleAxisRef.current = k;
          viewport.scaleAxisRef.current = k;
          setStatusMessage(`Scale ${k.toUpperCase()} axis`);
          return;
        }
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
          if (mode === "object") {
            removeObject();
          } else {
            meshOps.deleteSelected();
          }
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
              scaleAxisRef.current = "uniform";
              viewport.scaleAxisRef.current = "uniform";
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
            scaleAxisRef.current = null;
            viewport.scaleAxisRef.current = null;
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
  }, [activeTool, mode, meshOps, setActiveTool, setStatusMessage, updateCursor, contextMenu, duplicateObject, removeObject, startRename, viewport]);

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
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}
      {renameInput && (
        <input
          data-testid="rename-input"
          autoFocus
          defaultValue={renameInput.value}
          style={{
            position: "fixed",
            left: renameInput.x,
            top: renameInput.y,
            zIndex: 10001,
            background: "#303030",
            color: "#d0d0d0",
            border: "1px solid #4b6eaf",
            borderRadius: 3,
            padding: "4px 8px",
            fontSize: 13,
            fontFamily: "system-ui, -apple-system, sans-serif",
            outline: "none",
            minWidth: 150,
          }}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              renameObject((e.target as HTMLInputElement).value);
              setRenameInput(null);
            } else if (e.key === "Escape") {
              setRenameInput(null);
            }
          }}
          onBlur={() => setRenameInput(null)}
        />
      )}
    </div>
  );
}
