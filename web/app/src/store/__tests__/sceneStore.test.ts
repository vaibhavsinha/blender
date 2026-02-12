import { describe, it, expect, beforeEach } from "vitest";
import { useSceneStore } from "../sceneStore";

describe("sceneStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useSceneStore.setState({
      mode: "edit",
      activeTool: "select",
      objectCount: 0,
      activeObjectIndex: -1,
      selectedFaceCount: 0,
      vertexCount: 0,
      faceCount: 0,
      wasmReady: false,
      fps: 0,
      statusMessage: "Loading WASM module...",
    });
  });

  it("has correct initial defaults", () => {
    const state = useSceneStore.getState();
    expect(state.mode).toBe("edit");
    expect(state.activeTool).toBe("select");
    expect(state.objectCount).toBe(0);
    expect(state.activeObjectIndex).toBe(-1);
    expect(state.selectedFaceCount).toBe(0);
    expect(state.vertexCount).toBe(0);
    expect(state.faceCount).toBe(0);
    expect(state.wasmReady).toBe(false);
    expect(state.fps).toBe(0);
    expect(state.statusMessage).toBe("Loading WASM module...");
  });

  it("setMode transitions between object and edit", () => {
    useSceneStore.getState().setMode("object");
    expect(useSceneStore.getState().mode).toBe("object");
    useSceneStore.getState().setMode("edit");
    expect(useSceneStore.getState().mode).toBe("edit");
  });

  it.each(["select", "grab", "rotate", "scale", "annotate", "measure"] as const)(
    "setActiveTool sets tool to %s",
    (tool) => {
      useSceneStore.getState().setActiveTool(tool);
      expect(useSceneStore.getState().activeTool).toBe(tool);
    },
  );

  it("setMeshStats updates all three fields atomically", () => {
    useSceneStore.getState().setMeshStats(100, 50, 10);
    const state = useSceneStore.getState();
    expect(state.vertexCount).toBe(100);
    expect(state.faceCount).toBe(50);
    expect(state.selectedFaceCount).toBe(10);
  });

  it("setWasmReady toggles the flag", () => {
    useSceneStore.getState().setWasmReady(true);
    expect(useSceneStore.getState().wasmReady).toBe(true);
    useSceneStore.getState().setWasmReady(false);
    expect(useSceneStore.getState().wasmReady).toBe(false);
  });

  it("setFps updates fps", () => {
    useSceneStore.getState().setFps(60);
    expect(useSceneStore.getState().fps).toBe(60);
  });

  it("setStatusMessage updates the message", () => {
    useSceneStore.getState().setStatusMessage("Ready");
    expect(useSceneStore.getState().statusMessage).toBe("Ready");
  });

  it("setObjectCount updates object count", () => {
    useSceneStore.getState().setObjectCount(3);
    expect(useSceneStore.getState().objectCount).toBe(3);
  });

  it("setActiveObjectIndex updates the index", () => {
    useSceneStore.getState().setActiveObjectIndex(2);
    expect(useSceneStore.getState().activeObjectIndex).toBe(2);
  });

  it("multiple setMeshStats calls keep latest values", () => {
    useSceneStore.getState().setMeshStats(10, 5, 2);
    useSceneStore.getState().setMeshStats(200, 100, 50);
    const state = useSceneStore.getState();
    expect(state.vertexCount).toBe(200);
    expect(state.faceCount).toBe(100);
    expect(state.selectedFaceCount).toBe(50);
  });
});
