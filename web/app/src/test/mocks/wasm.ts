import { vi } from "vitest";
import type { EditMesh, Camera, SceneObject, Scene } from "../../types/wasm";

export interface MockEditMeshInternals {
  __selected: Set<number>;
  __translations: Array<{ dx: number; dy: number; dz: number }>;
  __rotations: Array<{ ax: number; ay: number; az: number; angle: number }>;
  __scales: Array<{ sx: number; sy: number; sz: number }>;
  __extrudeCount: number;
  __subdivideCount: number;
  __deleteCount: number;
  __vertCount: number;
  __faceCount: number;
  __smoothShading: boolean;
}

export type MockEditMesh = EditMesh & MockEditMeshInternals;

export function createMockEditMesh(vertCount = 8, faceCount = 6): MockEditMesh {
  const selected = new Set<number>();
  const translations: Array<{ dx: number; dy: number; dz: number }> = [];
  const rotations: Array<{ ax: number; ay: number; az: number; angle: number }> = [];
  const scales: Array<{ sx: number; sy: number; sz: number }> = [];
  let extrudeCount = 0;
  let subdivideCount = 0;
  let deleteCount = 0;
  let currentVertCount = vertCount;
  let currentFaceCount = faceCount;

  let smoothShading = false;

  const mesh: MockEditMesh = {
    __selected: selected,
    __translations: translations,
    __rotations: rotations,
    __scales: scales,
    __extrudeCount: 0,
    __subdivideCount: 0,
    __deleteCount: 0,
    __vertCount: vertCount,
    __faceCount: faceCount,
    __smoothShading: false,
    vertexCount: vi.fn(() => currentVertCount),
    faceCount: vi.fn(() => currentFaceCount),
    selectFace: vi.fn((index: number) => {
      selected.add(index);
    }),
    deselectFace: vi.fn((index: number) => {
      selected.delete(index);
    }),
    selectAll: vi.fn(() => {
      for (let i = 0; i < currentFaceCount; i++) selected.add(i);
    }),
    deselectAll: vi.fn(() => {
      selected.clear();
    }),
    toggleSelectAll: vi.fn(() => {
      if (selected.size === currentFaceCount) {
        selected.clear();
      } else {
        for (let i = 0; i < currentFaceCount; i++) selected.add(i);
      }
    }),
    invertSelection: vi.fn(() => {
      for (let i = 0; i < currentFaceCount; i++) {
        if (selected.has(i)) {
          selected.delete(i);
        } else {
          selected.add(i);
        }
      }
    }),
    isFaceSelected: vi.fn((index: number) => selected.has(index)),
    selectedFaceCount: vi.fn(() => selected.size),
    translateSelected: vi.fn((dx: number, dy: number, dz: number) => {
      translations.push({ dx, dy, dz });
    }),
    rotateSelected: vi.fn(
      (ax: number, ay: number, az: number, angle: number) => {
        rotations.push({ ax, ay, az, angle });
      },
    ),
    scaleSelected: vi.fn((sx: number, sy: number, sz: number) => {
      scales.push({ sx, sy, sz });
    }),
    extrudeSelectedFaces: vi.fn((_distance: number) => {
      extrudeCount++;
      mesh.__extrudeCount = extrudeCount;
      // Simulate adding verts/faces
      currentVertCount += selected.size * 4;
      currentFaceCount += selected.size;
      mesh.__vertCount = currentVertCount;
      mesh.__faceCount = currentFaceCount;
    }),
    subdivideSelectedFaces: vi.fn(() => {
      subdivideCount++;
      mesh.__subdivideCount = subdivideCount;
    }),
    deleteSelectedFaces: vi.fn(() => {
      deleteCount++;
      mesh.__deleteCount = deleteCount;
      currentFaceCount -= selected.size;
      if (currentFaceCount < 0) currentFaceCount = 0;
      mesh.__faceCount = currentFaceCount;
      selected.clear();
    }),
    setShadeSmooth: vi.fn((smooth: boolean) => {
      smoothShading = smooth;
      mesh.__smoothShading = smooth;
    }),
    getShadeSmooth: vi.fn(() => smoothShading),
    recalcNormals: vi.fn(),
    buildRenderData: vi.fn(() => ({
      positions: new Float32Array(currentVertCount * 3),
      normals: new Float32Array(currentVertCount * 3),
      colors: new Float32Array(currentVertCount * 3),
      solidIndices: new Uint32Array(currentFaceCount * 6),
      wireIndices: new Uint32Array(currentFaceCount * 8),
      vertexCount: currentVertCount,
      solidIndexCount: currentFaceCount * 6,
      wireIndexCount: currentFaceCount * 8,
    })),
    delete: vi.fn(),
  };

  return mesh;
}

export function createMockCamera(): Camera {
  let distance = 6;
  let azimuth = 0.78;
  let elevation = 0.52;
  const fov = 0.785;
  const nearClip = 0.1;
  const farClip = 1000;
  let aspectRatio = 16 / 9;

  return {
    get orbitDistance() { return distance; },
    set orbitDistance(v: number) { distance = v; },
    get orbitAzimuth() { return azimuth; },
    set orbitAzimuth(v: number) { azimuth = v; },
    get orbitElevation() { return elevation; },
    set orbitElevation(v: number) { elevation = v; },
    fov,
    nearClip,
    farClip,
    get aspectRatio() { return aspectRatio; },
    set aspectRatio(v: number) { aspectRatio = v; },
    orbit: vi.fn((dAz: number, dEl: number) => {
      azimuth += dAz;
      elevation = Math.max(-1.5, Math.min(1.5, elevation + dEl));
    }),
    pan: vi.fn(),
    zoom: vi.fn((delta: number) => {
      distance *= 1 - delta * 0.1;
      distance = Math.max(0.1, Math.min(500, distance));
    }),
    getViewMatrix: vi.fn(() => new Float32Array(16)),
    getProjectionMatrix: vi.fn(() => new Float32Array(16)),
    getEyePosition: vi.fn(() => new Float32Array([0, 4, 6])),
    delete: vi.fn(),
  };
}

export function createMockSceneObject(mesh?: MockEditMesh): SceneObject {
  const editMesh = mesh ?? createMockEditMesh();
  let objName = "Object";
  return {
    getMesh: vi.fn(() => editMesh),
    getTransformMatrix: vi.fn(() => Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])),
    getNormalMatrix: vi.fn(() => Float32Array.from([1,0,0,0,1,0,0,0,1])),
    getLocation: vi.fn(() => new Float32Array([0, 0, 0])),
    setLocation: vi.fn(),
    updateTransform: vi.fn(),
    getName: vi.fn(() => objName),
    setName: vi.fn((name: string) => { objName = name; }),
    selected: false,
    delete: vi.fn(),
  };
}

export function createMockScene(initialMesh?: MockEditMesh): Scene & { __objects: SceneObject[]; __camera: Camera } {
  const camera = createMockCamera();
  const objects: SceneObject[] = [];
  let activeIdx = -1;

  if (initialMesh) {
    objects.push(createMockSceneObject(initialMesh));
    activeIdx = 0;
  }

  const scene = {
    __objects: objects,
    __camera: camera,
    addCube: vi.fn((_size?: number) => {
      const mesh = createMockEditMesh(8, 6);
      objects.push(createMockSceneObject(mesh));
      activeIdx = objects.length - 1;
      return activeIdx;
    }),
    addPlane: vi.fn((_size?: number) => {
      const mesh = createMockEditMesh(4, 1);
      objects.push(createMockSceneObject(mesh));
      activeIdx = objects.length - 1;
      return activeIdx;
    }),
    getObject: vi.fn((index: number) => objects[index]),
    getActiveObject: vi.fn(() => (activeIdx >= 0 ? objects[activeIdx] : null)),
    getCamera: vi.fn(() => camera),
    objectCount: vi.fn(() => objects.length),
    duplicateActiveObject: vi.fn(() => {
      if (activeIdx < 0) return -1;
      const newObj = createMockSceneObject(createMockEditMesh(8, 6));
      objects.push(newObj);
      activeIdx = objects.length - 1;
      return activeIdx;
    }),
    removeObject: vi.fn((index: number) => {
      if (index >= 0 && index < objects.length) {
        objects.splice(index, 1);
        if (objects.length === 0) {
          activeIdx = -1;
        } else if (activeIdx >= objects.length) {
          activeIdx = objects.length - 1;
        }
      }
    }),
    get activeObjectIndex() { return activeIdx; },
    set activeObjectIndex(v: number) { activeIdx = v; },
    delete: vi.fn(),
  };

  return scene;
}
