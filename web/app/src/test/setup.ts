import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// Mock ResizeObserver — fires synchronously with 800x600 on observe()
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: { width: 800, height: 600, x: 0, y: 0, top: 0, left: 0, bottom: 600, right: 800 } as DOMRectReadOnly,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock requestAnimationFrame / cancelAnimationFrame
let rafId = 0;
globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  rafId++;
  return rafId;
}) as unknown as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame;

// Mock HTMLCanvasElement.getContext
const mockContext2d = () => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  setLineDash: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  canvas: { width: 800, height: 600 },
  strokeStyle: "",
  fillStyle: "",
  lineWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  font: "",
  textAlign: "start",
  textBaseline: "alphabetic",
});

const mockWebGL2 = () => ({
  createShader: vi.fn(() => ({})),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  getShaderInfoLog: vi.fn(() => ""),
  createProgram: vi.fn(() => ({})),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  getProgramInfoLog: vi.fn(() => ""),
  getUniformLocation: vi.fn(() => ({})),
  useProgram: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  depthFunc: vi.fn(),
  blendFunc: vi.fn(),
  clearColor: vi.fn(),
  clear: vi.fn(),
  viewport: vi.fn(),
  createVertexArray: vi.fn(() => ({})),
  bindVertexArray: vi.fn(),
  createBuffer: vi.fn(() => ({})),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  drawArrays: vi.fn(),
  drawElements: vi.fn(),
  uniformMatrix4fv: vi.fn(),
  uniformMatrix3fv: vi.fn(),
  uniform3fv: vi.fn(),
  uniform3f: vi.fn(),
  deleteShader: vi.fn(),
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  FLOAT: 0x1406,
  UNSIGNED_INT: 0x1405,
  TRIANGLES: 0x0004,
  LINES: 0x0001,
  DEPTH_TEST: 0x0b71,
  BLEND: 0x0be2,
  LEQUAL: 0x0203,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  COLOR_BUFFER_BIT: 0x4000,
  DEPTH_BUFFER_BIT: 0x0100,
  STATIC_DRAW: 0x88e4,
  DYNAMIC_DRAW: 0x88e8,
});

const originalGetContext = HTMLCanvasElement.prototype.getContext;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: any[]) {
  if (contextId === "2d") {
    return mockContext2d() as unknown as CanvasRenderingContext2D;
  }
  if (contextId === "webgl2") {
    return mockWebGL2() as unknown as WebGL2RenderingContext;
  }
  return originalGetContext.call(this, contextId, ...args);
} as typeof HTMLCanvasElement.prototype.getContext;

// Mock getBoundingClientRect to return non-zero dimensions
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 800,
  height: 600,
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  bottom: 600,
  right: 800,
  toJSON: () => {},
}));

// Suppress performance.now noise
if (!globalThis.performance) {
  globalThis.performance = { now: () => 0 } as Performance;
}
