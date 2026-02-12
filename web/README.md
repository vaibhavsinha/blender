# Blender Web Lite

A trimmed-down Blender running in the browser via WebAssembly + React. Provides a 3D viewport with mesh editing tools, orbital camera, and annotation/measurement overlays.

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Emscripten SDK** (only required if building the WASM module from source)

## Project Structure

```
web/
├── wasm/                        C++ WASM module (Emscripten)
│   ├── src/
│   │   ├── mesh.h / mesh.cc    EditMesh: vertices, faces, selection, transforms
│   │   ├── scene.h             Scene, Camera, SceneObject
│   │   └── bindings.cc         Emscripten embind JS API
│   ├── stubs/                   WASM stubs for unsupported Blender subsystems
│   ├── shaders/                 GLSL shaders (solid, wireframe, grid)
│   ├── CMakeLists.txt           Emscripten build config
│   └── build/                   Build output
└── app/                         React + Vite frontend
    ├── public/
    │   ├── blender_web.js       Compiled WASM loader
    │   └── blender_web.wasm     Compiled WASM binary
    ├── src/
    │   ├── App.tsx              Root layout (header, toolbar, viewport, properties, status)
    │   ├── types/wasm.d.ts      TypeScript interfaces for WASM module
    │   ├── store/sceneStore.ts  Zustand store (mode, activeTool, mesh stats)
    │   ├── hooks/
    │   │   ├── useViewport.ts       WebGL rendering, orbit/pan/zoom camera
    │   │   ├── useMeshOperations.ts Mesh ops + modal tool state (grab/rotate/scale)
    │   │   └── useBlenderWasm.ts    WASM module loader
    │   ├── components/
    │   │   ├── ViewportCanvas.tsx    WebGL canvas + keyboard/mouse + overlay wrapper
    │   │   ├── Toolbar.tsx          Left toolbar with tool icons
    │   │   ├── AnnotationOverlay.tsx 2D freehand drawing overlay
    │   │   ├── MeasureOverlay.tsx   Click-to-measure distance overlay
    │   │   ├── HeaderBar.tsx        Top bar
    │   │   ├── PropertiesPanel.tsx  Right sidebar
    │   │   └── StatusBar.tsx        Bottom status bar
    │   └── test/
    │       ├── setup.ts             Vitest global mocks (ResizeObserver, canvas, rAF)
    │       └── mocks/wasm.ts        Stateful WASM mock for testing
    ├── vitest.config.ts         Vitest configuration
    ├── tsconfig.json            TypeScript configuration
    └── package.json             Dependencies and scripts
```

## Quick Start (without WASM)

The app renders a fallback cube with full orbit/zoom/pan when the WASM module isn't present.

```bash
cd web/app
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Building the WASM Module

Requires the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) to be installed and activated.

```bash
# 1. Build the WASM module
cd web/wasm
mkdir -p build && cd build
emcmake cmake ..
emmake make -j$(nproc)

# 2. Copy artifacts to the React app's public directory
cp blender_web.js blender_web.wasm ../../app/public/

# 3. Run the app
cd ../../app
npm run dev
```

For a release (optimized) build:

```bash
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
emmake make -j$(nproc)
```

## Available Scripts

All scripts run from `web/app/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production (output in `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once (CI mode) |

## Testing

The project uses [Vitest](https://vitest.dev/) with jsdom, [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/), and a stateful WASM mock.

```bash
cd web/app

# Watch mode (re-runs on file changes)
npm test

# Single run (for CI)
npm run test:run
```

### Test structure

Tests live in `__tests__/` directories alongside the code they test:

| Test file | What it covers |
|-----------|---------------|
| `store/__tests__/sceneStore.test.ts` | Zustand store state transitions |
| `hooks/__tests__/useMeshOperations.test.ts` | Mesh operations, modal tool lifecycle, selection guards |
| `components/__tests__/Toolbar.test.tsx` | Button rendering, tool switching, edit mode visibility |
| `components/__tests__/ViewportCanvas.test.tsx` | Keyboard shortcuts, mouse interactions, bug regression tests |
| `components/__tests__/AnnotationOverlay.test.tsx` | Stroke drawing, pointer events, escape clearing |
| `components/__tests__/MeasureOverlay.test.tsx` | Click-to-measure, distance calculation, escape clearing |

### Writing new tests

1. Import mocks from `src/test/mocks/wasm.ts`:
   ```ts
   import { createMockEditMesh, createMockScene } from "../../test/mocks/wasm";
   ```
2. The mock tracks all operations on internal `__selected`, `__translations`, `__rotations`, `__scales` properties for assertions.
3. Global mocks in `src/test/setup.ts` handle `ResizeObserver`, `requestAnimationFrame`, `getBoundingClientRect`, and canvas `getContext("2d")`/`getContext("webgl2")`.

## Keyboard Shortcuts

| Key | Action | Mode |
|-----|--------|------|
| Click | Cycle face selection | Edit + Select tool |
| Drag | Orbit camera | Any |
| Shift+Drag | Pan camera | Any |
| Scroll | Zoom camera | Any |
| A | Toggle select all faces | Edit |
| G | Grab/move selected faces (modal) | Edit |
| R | Rotate selected faces (modal) | Edit |
| S | Scale selected faces (modal) | Edit |
| E | Extrude selected faces | Edit |
| W | Subdivide selected faces | Edit |
| X / Delete | Delete selected faces | Edit |
| Escape | Cancel active modal / clear annotations or measurements | Any |

**Modal tools** (G/R/S): Move the mouse to transform, click to confirm, Escape to cancel and revert.

## Architecture

### WASM-React Bridge

The C++ mesh engine is compiled to WebAssembly via Emscripten and exposed to JavaScript through `embind`. The React app communicates with it through typed interfaces:

```
React Components
  └── useMeshOperations hook
        └── sceneRef.current (Scene)
              ├── getActiveObject() → SceneObject
              │     └── getMesh() → EditMesh
              │           ├── selectFace / deselectAll / toggleSelectAll
              │           ├── translateSelected / rotateSelected / scaleSelected
              │           ├── extrudeSelectedFaces / subdivideSelectedFaces / deleteSelectedFaces
              │           └── buildRenderData() → Float32Array / Uint32Array (zero-copy to WebGL)
              └── getCamera() → Camera
                    └── orbit / pan / zoom + matrix getters
```

### State Management

[Zustand](https://github.com/pmndrs/zustand) store (`sceneStore.ts`) holds UI state:

- `mode`: `"object"` | `"edit"`
- `activeTool`: `"select"` | `"grab"` | `"rotate"` | `"scale"` | `"annotate"` | `"measure"`
- Mesh stats: `vertexCount`, `faceCount`, `selectedFaceCount`
- `wasmReady`, `fps`, `statusMessage`

### Rendering

`useViewport` manages the WebGL2 rendering pipeline:
- Compiles GLSL ES 3.0 shaders (solid, wireframe, grid)
- Uploads mesh vertex/index data from WASM `buildRenderData()`
- Runs a `requestAnimationFrame` render loop
- Falls back to a static cube when WASM isn't loaded

## Type Checking

```bash
cd web/app
npx tsc --noEmit
```

## Production Build

```bash
cd web/app
npm run build
```

Output goes to `web/app/dist/`. Serve with any static file server or use `npm run preview`.
