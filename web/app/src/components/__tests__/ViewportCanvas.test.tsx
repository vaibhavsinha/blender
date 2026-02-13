import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { ViewportCanvas } from "../ViewportCanvas";
import { useSceneStore } from "../../store/sceneStore";
import { createMockEditMesh, createMockScene, type MockEditMesh } from "../../test/mocks/wasm";
import type { Scene } from "../../types/wasm";

// Mock useViewport to avoid WebGL setup
vi.mock("../../hooks/useViewport", () => ({
  useViewport: () => ({
    init: vi.fn(),
    render: vi.fn(),
    markDirty: vi.fn(),
    handleOrbit: vi.fn(),
    handlePan: vi.fn(),
    handleZoom: vi.fn(),
    startRenderLoop: vi.fn(),
    stopRenderLoop: vi.fn(),
    fallbackCamera: { current: {} },
  }),
}));

describe("ViewportCanvas", () => {
  let mesh: MockEditMesh;
  let scene: ReturnType<typeof createMockScene>;
  let sceneRef: React.RefObject<Scene | null>;

  beforeEach(() => {
    mesh = createMockEditMesh(8, 6);
    scene = createMockScene(mesh);
    sceneRef = { current: scene as unknown as Scene };
    useSceneStore.setState({
      mode: "edit",
      activeTool: "select",
      statusMessage: "",
    });
  });

  function renderCanvas() {
    return render(<ViewportCanvas sceneRef={sceneRef} />);
  }

  // --- Keyboard shortcuts ---

  it("A key triggers toggleSelectAll", () => {
    renderCanvas();
    fireEvent.keyDown(window, { key: "a" });
    expect(mesh.toggleSelectAll).toHaveBeenCalled();
  });

  it("E key triggers extrudeSelectedFaces when faces are selected", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "e" });
    expect(mesh.extrudeSelectedFaces).toHaveBeenCalledWith(0.5);
  });

  it("W key triggers subdivideSelectedFaces when faces are selected", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "w" });
    expect(mesh.subdivideSelectedFaces).toHaveBeenCalled();
  });

  it("X key triggers deleteSelectedFaces when faces are selected", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "x" });
    expect(mesh.deleteSelectedFaces).toHaveBeenCalled();
  });

  it("Delete key triggers deleteSelectedFaces when faces are selected", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(mesh.deleteSelectedFaces).toHaveBeenCalled();
  });

  it("G key activates grab modal when faces are selected", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "g" });
    expect(useSceneStore.getState().activeTool).toBe("grab");
  });

  it("R key activates rotate modal when faces are selected", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "r" });
    expect(useSceneStore.getState().activeTool).toBe("rotate");
  });

  it("S key activates scale modal when faces are selected", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "s" });
    expect(useSceneStore.getState().activeTool).toBe("scale");
  });

  it("Escape during normal mode resets tool to select", () => {
    act(() => useSceneStore.setState({ activeTool: "grab" }));
    renderCanvas();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useSceneStore.getState().activeTool).toBe("select");
  });

  // --- Bug #1: Escape during annotate/measure ---

  it("Escape during annotate does NOT reset tool to select (bug #1)", () => {
    act(() => useSceneStore.setState({ activeTool: "annotate" }));
    renderCanvas();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useSceneStore.getState().activeTool).toBe("annotate");
  });

  it("Escape during measure does NOT reset tool to select (bug #1)", () => {
    act(() => useSceneStore.setState({ activeTool: "measure" }));
    renderCanvas();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useSceneStore.getState().activeTool).toBe("measure");
  });

  // --- Bug #6: G with no selection ---

  it("G with no selection does NOT activate grab (bug #6)", () => {
    renderCanvas();
    fireEvent.keyDown(window, { key: "g" });
    expect(useSceneStore.getState().activeTool).toBe("select");
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for grab");
  });

  it("R with no selection does NOT activate rotate (bug #6)", () => {
    renderCanvas();
    fireEvent.keyDown(window, { key: "r" });
    expect(useSceneStore.getState().activeTool).toBe("select");
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for rotate");
  });

  it("S with no selection does NOT activate scale (bug #6)", () => {
    renderCanvas();
    fireEvent.keyDown(window, { key: "s" });
    expect(useSceneStore.getState().activeTool).toBe("select");
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for scale");
  });

  // --- Mouse interactions ---

  it("click in edit mode with select tool triggers face cycling", () => {
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 100, clientY: 100 });
    expect(mesh.selectFace).toHaveBeenCalled();
  });

  it("context menu is prevented", () => {
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const prevented = !canvas.dispatchEvent(event);
    expect(prevented).toBe(true);
  });

  // --- Bug #3: Overlay initial size ---

  it("overlay dimensions are seeded synchronously on mount (bug #3)", () => {
    const { container } = renderCanvas();
    // Both overlay canvases should exist with non-zero dimensions from getBoundingClientRect
    const canvases = container.querySelectorAll("canvas");
    // One is the WebGL canvas, the other two are annotation/measure overlays
    // With our mock getBoundingClientRect returning 800x600, the overlays should get 800x600
    const overlayCanvases = Array.from(canvases).filter(c => c.style.position === "absolute");
    for (const canvas of overlayCanvases) {
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    }
  });

  // --- Bug #4: Tool switch cancels active modal ---

  it("switching tool from toolbar cancels active grab modal (bug #4)", () => {
    mesh.selectFace(0);
    renderCanvas();
    // Start grab via G key
    fireEvent.keyDown(window, { key: "g" });
    expect(useSceneStore.getState().activeTool).toBe("grab");

    // Simulate external tool switch (as if toolbar clicked Select)
    act(() => useSceneStore.setState({ activeTool: "select" }));
    // The useEffect should cancel the grab - need to flush
    // The grab should be deactivated by the effect
    // We verify via status message being set to "Ready" by endGrab
    expect(useSceneStore.getState().statusMessage).toBe("Ready");
  });

  // --- G during active rotate is ignored ---

  it("G during active rotate is ignored", () => {
    mesh.selectFace(0);
    renderCanvas();
    fireEvent.keyDown(window, { key: "r" });
    expect(useSceneStore.getState().activeTool).toBe("rotate");
    fireEvent.keyDown(window, { key: "g" });
    // Should still be rotate, not grab
    expect(useSceneStore.getState().activeTool).toBe("rotate");
  });

  // --- Cursor mapping ---

  it("cursor is default for select tool", () => {
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    expect(canvas.style.cursor).toBe("default");
  });

  it("cursor is crosshair for annotate tool", () => {
    act(() => useSceneStore.setState({ activeTool: "annotate" }));
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    expect(canvas.style.cursor).toBe("crosshair");
  });

  // --- Overlay rendering ---

  it("renders AnnotationOverlay and MeasureOverlay", () => {
    const { container } = renderCanvas();
    // Should have 3 canvases: main WebGL + annotation overlay + measure overlay
    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBe(3);
  });

  // --- Context menu ---

  it("right-click opens context menu at cursor position", () => {
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 300 });
    const menu = document.querySelector("[role='menu']");
    expect(menu).toBeTruthy();
  });

  it("context menu shows edit mode items when in edit mode", () => {
    act(() => useSceneStore.setState({ mode: "edit" }));
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 300 });
    const menuItems = document.querySelectorAll("[role='menuitem']");
    const labels = Array.from(menuItems).map((el) => el.textContent?.trim());
    expect(labels.some((l) => l?.includes("Extrude Faces"))).toBe(true);
    expect(labels.some((l) => l?.includes("Delete Faces"))).toBe(true);
    expect(labels.some((l) => l?.includes("Invert Selection"))).toBe(true);
  });

  it("context menu shows object mode items when in object mode", () => {
    act(() => useSceneStore.setState({ mode: "object" }));
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 300 });
    const menuItems = document.querySelectorAll("[role='menuitem']");
    const labels = Array.from(menuItems).map((el) => el.textContent?.trim());
    expect(labels.some((l) => l?.includes("Duplicate Objects"))).toBe(true);
    expect(labels.some((l) => l?.includes("Rename Active Object"))).toBe(true);
    expect(labels.some((l) => l?.includes("Delete"))).toBe(true);
  });

  it("context menu action triggers operation and closes menu", () => {
    mesh.selectFace(0);
    renderCanvas();
    const canvas = document.querySelector("canvas")!;
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 300 });
    const menuItems = document.querySelectorAll("[role='menuitem']");
    const extrudeItem = Array.from(menuItems).find((el) =>
      el.textContent?.includes("Extrude Faces"),
    );
    expect(extrudeItem).toBeTruthy();
    fireEvent.click(extrudeItem!);
    expect(mesh.extrudeSelectedFaces).toHaveBeenCalled();
    // Menu should be closed
    const menu = document.querySelector("[role='menu']");
    expect(menu).toBeNull();
  });

  it("F2 opens rename input when active object exists", () => {
    renderCanvas();
    fireEvent.keyDown(window, { key: "F2" });
    const input = document.querySelector("[data-testid='rename-input']");
    expect(input).toBeTruthy();
  });
});
