import { create } from "zustand";

export type EditMode = "object" | "edit";
export type Tool = "select" | "grab" | "extrude" | "subdivide";

interface SceneState {
  mode: EditMode;
  activeTool: Tool;
  objectCount: number;
  activeObjectIndex: number;
  selectedFaceCount: number;
  vertexCount: number;
  faceCount: number;
  wasmReady: boolean;
  fps: number;
  statusMessage: string;

  setMode: (mode: EditMode) => void;
  setActiveTool: (tool: Tool) => void;
  setObjectCount: (count: number) => void;
  setActiveObjectIndex: (index: number) => void;
  setMeshStats: (verts: number, faces: number, selected: number) => void;
  setWasmReady: (ready: boolean) => void;
  setFps: (fps: number) => void;
  setStatusMessage: (msg: string) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
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

  setMode: (mode) => set({ mode }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setObjectCount: (count) => set({ objectCount: count }),
  setActiveObjectIndex: (index) => set({ activeObjectIndex: index }),
  setMeshStats: (vertexCount, faceCount, selectedFaceCount) =>
    set({ vertexCount, faceCount, selectedFaceCount }),
  setWasmReady: (ready) => set({ wasmReady: ready }),
  setFps: (fps) => set({ fps }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
}));
