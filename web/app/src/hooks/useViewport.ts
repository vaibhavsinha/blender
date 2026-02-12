import { useCallback, useRef, useEffect } from "react";
import type { Scene } from "../types/wasm";
import { useSceneStore } from "../store/sceneStore";

// Shader sources (GLSL ES 3.0)
const SOLID_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec3 a_color;
uniform mat4 u_model, u_view, u_projection;
uniform mat3 u_normal_matrix;
out vec3 v_normal, v_position, v_color;
void main() {
  vec4 wp = u_model * vec4(a_position, 1.0);
  v_position = wp.xyz;
  v_normal = normalize(u_normal_matrix * a_normal);
  v_color = a_color;
  gl_Position = u_projection * u_view * wp;
}`;

const SOLID_FRAG = `#version 300 es
precision highp float;
in vec3 v_normal, v_position, v_color;
uniform vec3 u_light_dir, u_eye_pos;
out vec4 frag_color;
void main() {
  vec3 N = normalize(v_normal);
  vec3 L = normalize(u_light_dir);
  vec3 V = normalize(u_eye_pos - v_position);
  vec3 H = normalize(L + V);
  float ambient = 0.15;
  float diff = max(dot(N, L), 0.0);
  float back = max(dot(N, -L), 0.0) * 0.1;
  float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.3;
  vec3 color = v_color * (ambient + diff + back) + vec3(spec);
  frag_color = vec4(color, 1.0);
}`;

const WIRE_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
uniform mat4 u_model, u_view, u_projection;
void main() {
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
}`;

const WIRE_FRAG = `#version 300 es
precision highp float;
uniform vec3 u_color;
out vec4 frag_color;
void main() { frag_color = vec4(u_color, 1.0); }`;

const GRID_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
uniform mat4 u_view, u_projection;
out vec3 v_world_pos;
void main() {
  v_world_pos = a_position;
  gl_Position = u_projection * u_view * vec4(a_position, 1.0);
}`;

const GRID_FRAG = `#version 300 es
precision highp float;
in vec3 v_world_pos;
uniform vec3 u_eye_pos;
out vec4 frag_color;
void main() {
  vec2 grid = abs(fract(v_world_pos.xz - 0.5) - 0.5);
  vec2 line = fwidth(v_world_pos.xz);
  vec2 aa = smoothstep(vec2(0.0), line * 1.5, grid);
  float gv = 1.0 - min(aa.x, aa.y);
  float dist = length(v_world_pos.xz - u_eye_pos.xz);
  float fade = 1.0 - smoothstep(20.0, 50.0, dist);
  vec3 color = vec3(0.35);
  if(abs(v_world_pos.z) < line.y * 1.5) color = vec3(0.8, 0.2, 0.2);
  if(abs(v_world_pos.x) < line.x * 1.5) color = vec3(0.2, 0.8, 0.2);
  frag_color = vec4(color, gv * fade * 0.5);
}`;

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface ObjectBuffers {
  vao: WebGLVertexArrayObject;
  positionBuf: WebGLBuffer;
  normalBuf: WebGLBuffer;
  colorBuf: WebGLBuffer;
  solidIndexBuf: WebGLBuffer;
  wireIndexBuf: WebGLBuffer;
  solidIndexCount: number;
  wireIndexCount: number;
  dirty: boolean;
}

// Fallback camera (used when WASM isn't available)
class FallbackCamera {
  distance = 6;
  azimuth = 0.78;
  elevation = 0.52;
  target = [0, 0, 0];
  aspect = 16 / 9;

  orbit(dAz: number, dEl: number) {
    this.azimuth += dAz;
    this.elevation = Math.max(-1.5, Math.min(1.5, this.elevation + dEl));
  }
  pan(dx: number, dy: number) {
    const ca = Math.cos(this.azimuth), sa = Math.sin(this.azimuth);
    this.target[0] -= ca * dx * this.distance * 0.002;
    this.target[2] += sa * dx * this.distance * 0.002;
    this.target[1] -= dy * this.distance * 0.002;
  }
  zoom(delta: number) {
    this.distance *= 1 - delta * 0.1;
    this.distance = Math.max(0.1, Math.min(500, this.distance));
  }
  getEye(): [number, number, number] {
    const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);
    return [
      this.target[0] + this.distance * ce * Math.sin(this.azimuth),
      this.target[1] + this.distance * se,
      this.target[2] + this.distance * ce * Math.cos(this.azimuth),
    ];
  }
  getViewMatrix(): Float32Array {
    const eye = this.getEye();
    const t = this.target;
    const f = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]];
    const fl = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    f[0] /= fl; f[1] /= fl; f[2] /= fl;
    const up = [0, 1, 0];
    const s = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
    const sl = Math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
    s[0] /= sl; s[1] /= sl; s[2] /= sl;
    const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const m = new Float32Array(16);
    m[0] = s[0]; m[4] = s[1]; m[8] = s[2];
    m[1] = u[0]; m[5] = u[1]; m[9] = u[2];
    m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2];
    m[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
    m[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
    m[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
    m[15] = 1;
    return m;
  }
  getProjectionMatrix(): Float32Array {
    const fov = 0.785;
    const near = 0.1, far = 1000;
    const t = near * Math.tan(fov * 0.5);
    const r = t * this.aspect;
    const m = new Float32Array(16);
    m[0] = near / r;
    m[5] = near / t;
    m[10] = -(far + near) / (far - near);
    m[11] = -1;
    m[14] = -2 * far * near / (far - near);
    return m;
  }
}

// Fallback cube geometry (when WASM isn't available)
function createFallbackCube(): {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  solidIndices: Uint32Array;
  wireIndices: Uint32Array;
} {
  const s = 1;
  // 6 faces, 4 verts each = 24 verts
  const faceNormals = [
    [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0],
  ];
  const faceVerts = [
    [[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s]],
    [[s,-s,s],[-s,-s,s],[-s,s,s],[s,s,s]],
    [[-s,-s,s],[-s,-s,-s],[-s,s,-s],[-s,s,s]],
    [[s,-s,-s],[s,-s,s],[s,s,s],[s,s,-s]],
    [[-s,-s,s],[s,-s,s],[s,-s,-s],[-s,-s,-s]],
    [[-s,s,-s],[s,s,-s],[s,s,s],[-s,s,s]],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const solidIndices: number[] = [];
  const wireIndices: number[] = [];
  let vi = 0;
  for (let fi = 0; fi < 6; fi++) {
    for (let v = 0; v < 4; v++) {
      positions.push(...faceVerts[fi][v]);
      normals.push(...faceNormals[fi]);
      colors.push(0.5, 0.5, 0.5);
    }
    solidIndices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    wireIndices.push(vi, vi + 1, vi + 1, vi + 2, vi + 2, vi + 3, vi + 3, vi);
    vi += 4;
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    solidIndices: new Uint32Array(solidIndices),
    wireIndices: new Uint32Array(wireIndices),
  };
}

export function useViewport(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  sceneRef: React.RefObject<Scene | null>,
) {
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const solidShaderRef = useRef<ShaderProgram | null>(null);
  const wireShaderRef = useRef<ShaderProgram | null>(null);
  const gridShaderRef = useRef<ShaderProgram | null>(null);
  const objectBuffersRef = useRef<ObjectBuffers[]>([]);
  const gridVaoRef = useRef<WebGLVertexArrayObject | null>(null);
  const fallbackCameraRef = useRef(new FallbackCamera());
  const animFrameRef = useRef(0);
  const needsUploadRef = useRef(true);
  const { setFps, setMeshStats } = useSceneStore();

  const compileShader = useCallback(
    (gl: WebGL2RenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    },
    [],
  );

  const createProgram = useCallback(
    (
      gl: WebGL2RenderingContext,
      vsrc: string,
      fsrc: string,
      uniformNames: string[],
    ): ShaderProgram | null => {
      const vs = compileShader(gl, gl.VERTEX_SHADER, vsrc);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsrc);
      if (!vs || !fs) return null;
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(prog));
        return null;
      }
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      for (const name of uniformNames) {
        uniforms[name] = gl.getUniformLocation(prog, name);
      }
      return { program: prog, uniforms };
    },
    [compileShader],
  );

  const uploadObjectData = useCallback(
    (
      gl: WebGL2RenderingContext,
      index: number,
      data: {
        positions: Float32Array;
        normals: Float32Array;
        colors: Float32Array;
        solidIndices: Uint32Array;
        wireIndices: Uint32Array;
      },
    ) => {
      let buf = objectBuffersRef.current[index];
      if (!buf) {
        buf = {
          vao: gl.createVertexArray()!,
          positionBuf: gl.createBuffer()!,
          normalBuf: gl.createBuffer()!,
          colorBuf: gl.createBuffer()!,
          solidIndexBuf: gl.createBuffer()!,
          wireIndexBuf: gl.createBuffer()!,
          solidIndexCount: 0,
          wireIndexCount: 0,
          dirty: false,
        };
        objectBuffersRef.current[index] = buf;
      }

      gl.bindVertexArray(buf.vao);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf.positionBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf.normalBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf.colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.solidIndexBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.solidIndices, gl.DYNAMIC_DRAW);

      buf.solidIndexCount = data.solidIndices.length;
      buf.wireIndexCount = data.wireIndices.length;

      // Wire index buffer (separate, used with a different VAO binding)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.wireIndexBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.wireIndices, gl.DYNAMIC_DRAW);

      gl.bindVertexArray(null);
      buf.dirty = false;
    },
    [],
  );

  const initGrid = useCallback((gl: WebGL2RenderingContext) => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    // Large ground plane for grid
    const gridSize = 50;
    const verts = new Float32Array([
      -gridSize, 0, -gridSize,
       gridSize, 0, -gridSize,
       gridSize, 0,  gridSize,
      -gridSize, 0, -gridSize,
       gridSize, 0,  gridSize,
      -gridSize, 0,  gridSize,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gridVaoRef.current = vao;
  }, []);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.error("WebGL2 not available");
      return;
    }
    glRef.current = gl;

    // Compile shaders
    solidShaderRef.current = createProgram(gl, SOLID_VERT, SOLID_FRAG, [
      "u_model", "u_view", "u_projection", "u_normal_matrix", "u_light_dir", "u_eye_pos",
    ]);
    wireShaderRef.current = createProgram(gl, WIRE_VERT, WIRE_FRAG, [
      "u_model", "u_view", "u_projection", "u_color",
    ]);
    gridShaderRef.current = createProgram(gl, GRID_VERT, GRID_FRAG, [
      "u_view", "u_projection", "u_eye_pos",
    ]);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.18, 0.18, 0.18, 1.0);

    initGrid(gl);
  }, [canvasRef, createProgram, initGrid]);

  const markDirty = useCallback(() => {
    needsUploadRef.current = true;
  }, []);

  const render = useCallback(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas) return;

    // Resize canvas to fill container
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }

    const scene = sceneRef.current;
    const cam = fallbackCameraRef.current;
    cam.aspect = w / h;

    // Get matrices from WASM scene camera or fallback
    let viewMatrix: Float32Array;
    let projMatrix: Float32Array;
    let eyePos: Float32Array;

    if (scene) {
      const wasmCam = scene.getCamera();
      wasmCam.aspectRatio = w / h;
      viewMatrix = wasmCam.getViewMatrix();
      projMatrix = wasmCam.getProjectionMatrix();
      eyePos = wasmCam.getEyePosition();
    } else {
      viewMatrix = cam.getViewMatrix();
      projMatrix = cam.getProjectionMatrix();
      const eye = cam.getEye();
      eyePos = new Float32Array(eye);
    }

    // Upload mesh data if dirty
    if (needsUploadRef.current) {
      if (scene) {
        const count = scene.objectCount();
        for (let i = 0; i < count; i++) {
          const obj = scene.getObject(i);
          const mesh = obj.getMesh();
          const rd = mesh.buildRenderData();
          uploadObjectData(gl, i, rd);

          if (i === scene.activeObjectIndex) {
            setMeshStats(mesh.vertexCount(), mesh.faceCount(), mesh.selectedFaceCount());
          }
        }
      } else {
        // Fallback: upload a static cube
        const cube = createFallbackCube();
        uploadObjectData(gl, 0, cube);
        setMeshStats(8, 6, 0);
      }
      needsUploadRef.current = false;
    }

    // Clear
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const lightDir = new Float32Array([0.5, 0.8, 0.6]);

    // Draw grid
    const gridShader = gridShaderRef.current;
    if (gridShader && gridVaoRef.current) {
      gl.useProgram(gridShader.program);
      gl.uniformMatrix4fv(gridShader.uniforms["u_view"], false, viewMatrix);
      gl.uniformMatrix4fv(gridShader.uniforms["u_projection"], false, projMatrix);
      gl.uniform3fv(gridShader.uniforms["u_eye_pos"], eyePos);
      gl.bindVertexArray(gridVaoRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Draw objects
    const solidShader = solidShaderRef.current;
    const wireShader = wireShaderRef.current;
    const objCount = scene ? scene.objectCount() : 1;

    for (let i = 0; i < objCount; i++) {
      const buf = objectBuffersRef.current[i];
      if (!buf) continue;

      let modelMatrix: Float32Array;
      let normalMatrix: Float32Array;

      if (scene) {
        const obj = scene.getObject(i);
        modelMatrix = obj.getTransformMatrix();
        normalMatrix = obj.getNormalMatrix();
      } else {
        modelMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        normalMatrix = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      }

      // Solid pass
      if (solidShader && buf.solidIndexCount > 0) {
        gl.useProgram(solidShader.program);
        gl.uniformMatrix4fv(solidShader.uniforms["u_model"], false, modelMatrix);
        gl.uniformMatrix4fv(solidShader.uniforms["u_view"], false, viewMatrix);
        gl.uniformMatrix4fv(solidShader.uniforms["u_projection"], false, projMatrix);
        gl.uniformMatrix3fv(solidShader.uniforms["u_normal_matrix"], false, normalMatrix);
        gl.uniform3fv(solidShader.uniforms["u_light_dir"], lightDir);
        gl.uniform3fv(solidShader.uniforms["u_eye_pos"], eyePos);
        gl.bindVertexArray(buf.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.solidIndexBuf);
        gl.drawElements(gl.TRIANGLES, buf.solidIndexCount, gl.UNSIGNED_INT, 0);
      }

      // Wireframe pass
      if (wireShader && buf.wireIndexCount > 0) {
        gl.useProgram(wireShader.program);
        gl.uniformMatrix4fv(wireShader.uniforms["u_model"], false, modelMatrix);
        gl.uniformMatrix4fv(wireShader.uniforms["u_view"], false, viewMatrix);
        gl.uniformMatrix4fv(wireShader.uniforms["u_projection"], false, projMatrix);
        gl.uniform3f(wireShader.uniforms["u_color"]!, 0.0, 0.0, 0.0);
        gl.bindVertexArray(buf.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.wireIndexBuf);
        gl.drawElements(gl.LINES, buf.wireIndexCount, gl.UNSIGNED_INT, 0);
      }
    }

    gl.bindVertexArray(null);
  }, [canvasRef, sceneRef, uploadObjectData, setMeshStats]);

  // Camera controls (work with both WASM and fallback)
  const handleOrbit = useCallback(
    (dAz: number, dEl: number) => {
      const scene = sceneRef.current;
      if (scene) {
        scene.getCamera().orbit(dAz, dEl);
      } else {
        fallbackCameraRef.current.orbit(dAz, dEl);
      }
    },
    [sceneRef],
  );

  const handlePan = useCallback(
    (dx: number, dy: number) => {
      const scene = sceneRef.current;
      if (scene) {
        scene.getCamera().pan(dx, dy);
      } else {
        fallbackCameraRef.current.pan(dx, dy);
      }
    },
    [sceneRef],
  );

  const handleZoom = useCallback(
    (delta: number) => {
      const scene = sceneRef.current;
      if (scene) {
        scene.getCamera().zoom(delta);
      } else {
        fallbackCameraRef.current.zoom(delta);
      }
    },
    [sceneRef],
  );

  // Start render loop
  const startRenderLoop = useCallback(() => {
    let lastTime = performance.now();
    let frameCount = 0;

    function loop() {
      render();
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animFrameRef.current = requestAnimationFrame(loop);
    }
    animFrameRef.current = requestAnimationFrame(loop);
  }, [render, setFps]);

  const stopRenderLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  return {
    init,
    render,
    markDirty,
    handleOrbit,
    handlePan,
    handleZoom,
    startRenderLoop,
    stopRenderLoop,
    fallbackCamera: fallbackCameraRef,
  };
}
