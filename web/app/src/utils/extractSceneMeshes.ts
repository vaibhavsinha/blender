import type { Scene } from "../types/wasm";
import type { MeshExportData } from "./export3mf";

/**
 * Extract mesh data from all objects in a WASM Scene.
 */
export function extractSceneMeshes(scene: Scene): MeshExportData[] {
  const meshes: MeshExportData[] = [];
  const count = scene.objectCount();

  for (let i = 0; i < count; i++) {
    const obj = scene.getObject(i);
    const mesh = obj.getMesh();
    const rd = mesh.buildRenderData();

    let name = `Object ${i}`;
    try {
      if (typeof obj.getName === "function") {
        name = obj.getName();
      }
    } catch {
      // getName may not be available in older WASM builds
    }

    meshes.push({
      name,
      positions: rd.positions,
      solidIndices: rd.solidIndices,
      transformMatrix: obj.getTransformMatrix(),
    });
  }

  return meshes;
}

/**
 * Create export data for the fallback cube (used when WASM isn't loaded).
 * Matches the geometry from createFallbackCube() in useViewport.ts.
 */
export function extractFallbackCubeMesh(): MeshExportData[] {
  const s = 1;
  const faceVerts = [
    [[-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s]],
    [[s, -s, s], [-s, -s, s], [-s, s, s], [s, s, s]],
    [[-s, -s, s], [-s, -s, -s], [-s, s, -s], [-s, s, s]],
    [[s, -s, -s], [s, -s, s], [s, s, s], [s, s, -s]],
    [[-s, -s, s], [s, -s, s], [s, -s, -s], [-s, -s, -s]],
    [[-s, s, -s], [s, s, -s], [s, s, s], [-s, s, s]],
  ];

  const positions: number[] = [];
  const solidIndices: number[] = [];
  let vi = 0;

  for (let fi = 0; fi < 6; fi++) {
    for (let v = 0; v < 4; v++) {
      positions.push(...faceVerts[fi][v]);
    }
    solidIndices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  }

  // Identity 4x4 matrix
  const identity = new Float32Array(16);
  identity[0] = 1;
  identity[5] = 1;
  identity[10] = 1;
  identity[15] = 1;

  return [
    {
      name: "Cube",
      positions: new Float32Array(positions),
      solidIndices: new Uint32Array(solidIndices),
      transformMatrix: identity,
    },
  ];
}
