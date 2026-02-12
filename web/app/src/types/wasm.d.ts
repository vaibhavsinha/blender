export interface RenderData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  solidIndices: Uint32Array;
  wireIndices: Uint32Array;
  vertexCount: number;
  solidIndexCount: number;
  wireIndexCount: number;
}

export interface EditMesh {
  vertexCount(): number;
  faceCount(): number;
  selectFace(index: number): void;
  deselectFace(index: number): void;
  selectAll(): void;
  deselectAll(): void;
  toggleSelectAll(): void;
  isFaceSelected(index: number): boolean;
  selectedFaceCount(): number;
  translateSelected(dx: number, dy: number, dz: number): void;
  rotateSelected(axisX: number, axisY: number, axisZ: number, angleRadians: number): void;
  scaleSelected(sx: number, sy: number, sz: number): void;
  extrudeSelectedFaces(distance: number): void;
  subdivideSelectedFaces(): void;
  deleteSelectedFaces(): void;
  recalcNormals(): void;
  buildRenderData(): RenderData;
  delete(): void;
}

export interface Camera {
  orbitDistance: number;
  orbitAzimuth: number;
  orbitElevation: number;
  fov: number;
  nearClip: number;
  farClip: number;
  aspectRatio: number;
  orbit(dAzimuth: number, dElevation: number): void;
  pan(dx: number, dy: number): void;
  zoom(delta: number): void;
  getViewMatrix(): Float32Array;
  getProjectionMatrix(): Float32Array;
  getEyePosition(): Float32Array;
  delete(): void;
}

export interface SceneObject {
  getMesh(): EditMesh;
  getTransformMatrix(): Float32Array;
  getNormalMatrix(): Float32Array;
  getLocation(): Float32Array;
  setLocation(x: number, y: number, z: number): void;
  updateTransform(): void;
  selected: boolean;
  delete(): void;
}

export interface Scene {
  addCube(size?: number): number;
  addPlane(size?: number): number;
  getObject(index: number): SceneObject;
  getActiveObject(): SceneObject | null;
  getCamera(): Camera;
  objectCount(): number;
  activeObjectIndex: number;
  delete(): void;
}

export interface BlenderWebModule {
  Scene: { new (): Scene };
  EditMesh: {
    new (): EditMesh;
    createCube(size: number): EditMesh;
    createPlane(size: number): EditMesh;
  };
  Camera: { new (): Camera };
  SceneObject: { new (): SceneObject };
}

declare function createBlenderWeb(): Promise<BlenderWebModule>;
export default createBlenderWeb;
