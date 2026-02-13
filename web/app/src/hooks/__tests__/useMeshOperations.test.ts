import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMeshOperations } from "../useMeshOperations";
import { useSceneStore } from "../../store/sceneStore";
import {
  createMockEditMesh,
  createMockScene,
  type MockEditMesh,
} from "../../test/mocks/wasm";
import type { Scene } from "../../types/wasm";

describe("useMeshOperations", () => {
  let mesh: MockEditMesh;
  let scene: ReturnType<typeof createMockScene>;
  let sceneRef: React.RefObject<Scene | null>;
  let markDirty: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mesh = createMockEditMesh(8, 6);
    scene = createMockScene(mesh);
    sceneRef = { current: scene as unknown as Scene };
    markDirty = vi.fn();
    useSceneStore.setState({
      mode: "edit",
      activeTool: "select",
      statusMessage: "",
      vertexCount: 0,
      faceCount: 0,
      selectedFaceCount: 0,
    });
  });

  function renderMeshOps() {
    return renderHook(() => useMeshOperations(sceneRef, markDirty));
  }

  // --- Basic operations ---

  it("selectFace selects the given face and deselects others", () => {
    const { result } = renderMeshOps();
    act(() => result.current.selectFace(2));
    expect(mesh.deselectAll).toHaveBeenCalled();
    expect(mesh.selectFace).toHaveBeenCalledWith(2);
    expect(markDirty).toHaveBeenCalled();
  });

  it("toggleSelectAll delegates to mesh", () => {
    const { result } = renderMeshOps();
    act(() => result.current.toggleSelectAll());
    expect(mesh.toggleSelectAll).toHaveBeenCalled();
    expect(markDirty).toHaveBeenCalled();
  });

  it("extrudeSelected with selection calls mesh.extrudeSelectedFaces", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => result.current.extrudeSelected(0.5));
    expect(mesh.extrudeSelectedFaces).toHaveBeenCalledWith(0.5);
    expect(markDirty).toHaveBeenCalled();
  });

  it("extrudeSelected without selection shows status message", () => {
    const { result } = renderMeshOps();
    act(() => result.current.extrudeSelected(0.5));
    expect(mesh.extrudeSelectedFaces).not.toHaveBeenCalled();
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for extrude");
  });

  it("subdivideSelected with selection calls mesh.subdivideSelectedFaces", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => result.current.subdivideSelected());
    expect(mesh.subdivideSelectedFaces).toHaveBeenCalled();
  });

  it("subdivideSelected without selection shows status message", () => {
    const { result } = renderMeshOps();
    act(() => result.current.subdivideSelected());
    expect(mesh.subdivideSelectedFaces).not.toHaveBeenCalled();
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for subdivide");
  });

  it("deleteSelected with selection calls mesh.deleteSelectedFaces", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => result.current.deleteSelected());
    expect(mesh.deleteSelectedFaces).toHaveBeenCalled();
  });

  it("deleteSelected without selection shows status message", () => {
    const { result } = renderMeshOps();
    act(() => result.current.deleteSelected());
    expect(mesh.deleteSelectedFaces).not.toHaveBeenCalled();
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for delete");
  });

  // --- Translate / Rotate / Scale ---

  it("translateSelected delegates to mesh", () => {
    const { result } = renderMeshOps();
    act(() => result.current.translateSelected(1, 2, 3));
    expect(mesh.translateSelected).toHaveBeenCalledWith(1, 2, 3);
    expect(markDirty).toHaveBeenCalled();
  });

  it("rotateSelected delegates to mesh", () => {
    const { result } = renderMeshOps();
    act(() => result.current.rotateSelected(0, 1, 0, 0.5));
    expect(mesh.rotateSelected).toHaveBeenCalledWith(0, 1, 0, 0.5);
  });

  it("scaleSelected delegates to mesh", () => {
    const { result } = renderMeshOps();
    act(() => result.current.scaleSelected(2, 2, 2));
    expect(mesh.scaleSelected).toHaveBeenCalledWith(2, 2, 2);
  });

  // --- Grab lifecycle ---

  it("startGrab activates grab when faces are selected", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    let started = false;
    act(() => { started = result.current.startGrab(); });
    expect(started).toBe(true);
    expect(result.current.grabActiveRef.current).toBe(true);
  });

  it("startGrab returns false when no faces selected (bug #6)", () => {
    const { result } = renderMeshOps();
    let started = false;
    act(() => { started = result.current.startGrab(); });
    expect(started).toBe(false);
    expect(result.current.grabActiveRef.current).toBe(false);
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for grab");
  });

  it("endGrab(false) confirms — no reverse translation", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => { result.current.startGrab(); });
    // Simulate accumulation
    act(() => {
      result.current.translateSelected(0.1, 0.2, 0);
      result.current.grabCumulativeRef.current = { dx: 0.1, dy: 0.2, dz: 0 };
    });
    const translateCalls = (mesh.translateSelected as Mock).mock.calls.length;
    act(() => { result.current.endGrab(false); });
    // No additional reverse translate call
    expect((mesh.translateSelected as Mock).mock.calls.length).toBe(translateCalls);
    expect(result.current.grabActiveRef.current).toBe(false);
  });

  it("endGrab(true) cancels — applies reverse translation", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => { result.current.startGrab(); });
    act(() => {
      result.current.grabCumulativeRef.current = { dx: 0.5, dy: 0.3, dz: 0 };
    });
    act(() => { result.current.endGrab(true); });
    // Last call should be the reverse
    const calls = (mesh.translateSelected as Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBeCloseTo(-0.5);
    expect(lastCall[1]).toBeCloseTo(-0.3);
    expect(lastCall[2]).toBeCloseTo(0);
    expect(result.current.grabActiveRef.current).toBe(false);
  });

  // --- Rotate lifecycle ---

  it("startRotate activates when faces are selected", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    let started = false;
    act(() => { started = result.current.startRotate(); });
    expect(started).toBe(true);
    expect(result.current.rotateActiveRef.current).toBe(true);
  });

  it("startRotate returns false with no selection (bug #6)", () => {
    const { result } = renderMeshOps();
    let started = false;
    act(() => { started = result.current.startRotate(); });
    expect(started).toBe(false);
    expect(result.current.rotateActiveRef.current).toBe(false);
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for rotate");
  });

  it("endRotate(true) applies negative angle", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => { result.current.startRotate(); });
    act(() => {
      result.current.rotateAngleCumulativeRef.current = 1.5;
    });
    act(() => { result.current.endRotate(true); });
    const rotateCalls = (mesh.rotateSelected as Mock).mock.calls;
    const lastCall = rotateCalls[rotateCalls.length - 1];
    expect(lastCall[3]).toBeCloseTo(-1.5);
  });

  // --- Scale lifecycle ---

  it("startScale activates when faces are selected", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    let started = false;
    act(() => { started = result.current.startScale(); });
    expect(started).toBe(true);
    expect(result.current.scaleActiveRef.current).toBe(true);
  });

  it("startScale returns false with no selection (bug #6)", () => {
    const { result } = renderMeshOps();
    let started = false;
    act(() => { started = result.current.startScale(); });
    expect(started).toBe(false);
    expect(result.current.scaleActiveRef.current).toBe(false);
    expect(useSceneStore.getState().statusMessage).toBe("No faces selected for scale");
  });

  it("endScale(true) applies inverse factor", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => { result.current.startScale(); });
    act(() => {
      result.current.scaleCumulativeRef.current = 2;
    });
    act(() => { result.current.endScale(true); });
    const scaleCalls = (mesh.scaleSelected as Mock).mock.calls;
    const lastCall = scaleCalls[scaleCalls.length - 1];
    expect(lastCall[0]).toBeCloseTo(0.5);
    expect(lastCall[1]).toBeCloseTo(0.5);
    expect(lastCall[2]).toBeCloseTo(0.5);
  });

  // --- Null safety ---

  it("operations are safe when sceneRef is null", () => {
    sceneRef = { current: null };
    const { result } = renderMeshOps();
    // Should not throw
    act(() => {
      result.current.selectFace(0);
      result.current.toggleSelectAll();
      result.current.extrudeSelected(0.5);
      result.current.subdivideSelected();
      result.current.deleteSelected();
      result.current.translateSelected(1, 1, 1);
    });
    expect(markDirty).not.toHaveBeenCalled();
  });

  it("operations are safe when active object is null", () => {
    (scene.getActiveObject as Mock).mockReturnValue(null);
    const { result } = renderMeshOps();
    act(() => {
      result.current.selectFace(0);
      result.current.toggleSelectAll();
      result.current.extrudeSelected(0.5);
    });
    // selectFace calls deselectAll/selectFace on mesh, but with null obj it returns early
    expect(mesh.deselectAll).not.toHaveBeenCalled();
  });

  it("startGrab returns false when scene is null", () => {
    sceneRef = { current: null };
    const { result } = renderMeshOps();
    let started = false;
    act(() => { started = result.current.startGrab(); });
    expect(started).toBe(false);
  });

  // --- Shade smooth/flat ---

  it("setShadeSmooth(true) calls mesh.setShadeSmooth", () => {
    const { result } = renderMeshOps();
    act(() => result.current.setShadeSmooth(true));
    expect(mesh.setShadeSmooth).toHaveBeenCalledWith(true);
    expect(markDirty).toHaveBeenCalled();
    expect(useSceneStore.getState().statusMessage).toBe("Shade Smooth");
  });

  it("setShadeSmooth(false) calls mesh.setShadeSmooth", () => {
    const { result } = renderMeshOps();
    act(() => result.current.setShadeSmooth(false));
    expect(mesh.setShadeSmooth).toHaveBeenCalledWith(false);
    expect(markDirty).toHaveBeenCalled();
    expect(useSceneStore.getState().statusMessage).toBe("Shade Flat");
  });

  // --- Invert selection ---

  it("invertSelection toggles selection", () => {
    mesh.selectFace(0);
    mesh.selectFace(2);
    const { result } = renderMeshOps();
    act(() => result.current.invertSelection());
    expect(mesh.invertSelection).toHaveBeenCalled();
    expect(markDirty).toHaveBeenCalled();
  });

  // --- Mirror ---

  it("mirrorSelected('x') calls scaleSelected(-1, 1, 1)", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => result.current.mirrorSelected("x"));
    expect(mesh.scaleSelected).toHaveBeenCalledWith(-1, 1, 1);
    expect(markDirty).toHaveBeenCalled();
  });

  it("mirrorSelected('y') calls scaleSelected(1, -1, 1)", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => result.current.mirrorSelected("y"));
    expect(mesh.scaleSelected).toHaveBeenCalledWith(1, -1, 1);
  });

  it("mirrorSelected('z') calls scaleSelected(1, 1, -1)", () => {
    mesh.selectFace(0);
    const { result } = renderMeshOps();
    act(() => result.current.mirrorSelected("z"));
    expect(mesh.scaleSelected).toHaveBeenCalledWith(1, 1, -1);
  });
});
