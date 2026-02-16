# Blender Web Lite

A trimmed-down Blender running in the browser via WebAssembly + React. Provides a 3D viewport with mesh editing tools, orbital camera, annotation/measurement overlays, and one-click 3MF export for 3D printing.

## Prerequisites

- **Git**
- **Node.js** >= 18
- **npm** >= 9
- **Emscripten SDK** (only required if building the WASM module from source)

## Cloning the Repository

This project is a fork of the official Blender repository with a sparse checkout — only the `web/` directory and supporting build files are checked out to the working tree.

```bash
git clone https://github.com/vaibhavsinha/blender.git
cd blender
git checkout claude_code_hackathon
```

The web application lives under `web/`. Blender's C++ source files exist in git pack objects and can be read with `git show HEAD:<path>` but are not checked out by default.

## Quick Start (without WASM)

The app renders a fallback cube with full orbit/zoom/pan and 3MF export when the WASM module isn't present. This is the fastest way to get running.

```bash
cd web/app
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Building the WASM Module

For the full experience with the C++ mesh engine, you need to compile the WASM module using Emscripten.

### 1. Install the Emscripten SDK

```bash
# Clone emsdk
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate the latest version
./emsdk install latest
./emsdk activate latest

# Add to your current shell (run this in every new terminal, or add to your shell profile)
source ./emsdk_env.sh
```

Verify the installation:

```bash
emcc --version
```

See the [Emscripten Getting Started guide](https://emscripten.org/docs/getting_started/downloads.html) for platform-specific instructions.

### 2. Build the WASM module

```bash
cd web/wasm
mkdir -p build && cd build
emcmake cmake ..
emmake make -j$(nproc)
```

For a release (optimized) build:

```bash
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
emmake make -j$(nproc)
```

### 3. Copy artifacts to the React app

```bash
cp blender_web.js blender_web.wasm ../../app/public/
```

### 4. Run the app

```bash
cd ../../app
npm install
npm run dev
```

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
    │   ├── App.tsx              Root layout + export handler wiring
    │   ├── types/wasm.d.ts      TypeScript interfaces for WASM module
    │   ├── store/sceneStore.ts  Zustand store (mode, activeTool, mesh stats)
    │   ├── utils/
    │   │   ├── export3mf.ts         3MF export: vertex dedup, XML gen, ZIP, download
    │   │   └── extractSceneMeshes.ts Scene → MeshExportData bridge (WASM + fallback)
    │   ├── hooks/
    │   │   ├── useViewport.ts       WebGL rendering, orbit/pan/zoom camera
    │   │   ├── useMeshOperations.ts Mesh ops + modal tool state (grab/rotate/scale)
    │   │   └── useBlenderWasm.ts    WASM module loader
    │   ├── components/
    │   │   ├── ViewportCanvas.tsx    WebGL canvas + keyboard/mouse + overlay wrapper
    │   │   ├── HeaderBar.tsx        Top bar: mode buttons + Export 3MF button
    │   │   ├── Toolbar.tsx          Left toolbar with tool icons
    │   │   ├── AnnotationOverlay.tsx 2D freehand drawing overlay
    │   │   ├── MeasureOverlay.tsx   Click-to-measure distance overlay
    │   │   ├── PropertiesPanel.tsx  Right sidebar
    │   │   └── StatusBar.tsx        Bottom status bar
    │   └── test/
    │       ├── setup.ts             Vitest global mocks (ResizeObserver, canvas, rAF)
    │       └── mocks/wasm.ts        Stateful WASM mock for testing
    ├── vitest.config.ts         Vitest configuration
    ├── tsconfig.json            TypeScript configuration
    └── package.json             Dependencies and scripts
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
| `components/__tests__/HeaderBar.test.tsx` | Export button rendering, click callback, mode switching |
| `components/__tests__/ViewportCanvas.test.tsx` | Keyboard shortcuts, mouse interactions, bug regression tests |
| `components/__tests__/AnnotationOverlay.test.tsx` | Stroke drawing, pointer events, escape clearing |
| `components/__tests__/MeasureOverlay.test.tsx` | Click-to-measure, distance calculation, escape clearing |
| `components/__tests__/ContextMenu.test.tsx` | Right-click context menu, submenus, actions |
| `utils/__tests__/export3mf.test.ts` | Vertex dedup, transform baking, XML gen, ZIP packaging |

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
| Left-drag | Orbit camera | Any (when no transform tool modal is active) |
| Middle-drag | Orbit camera | Any |
| Shift+Left-drag | Pan camera | Any |
| Right-drag | Pan camera | Any |
| Scroll | Zoom camera | Any |
| A | Toggle select all faces | Edit |
| G | Grab/move selected faces (modal) | Edit |
| R | Rotate selected faces (modal) | Edit |
| S | Scale selected faces (modal, uniform) | Edit |
| X / Y / Z | Constrain scale to axis (during active scale modal) | Edit |
| E | Extrude selected faces | Edit |
| W | Subdivide selected faces | Edit |
| X / Delete | Delete selected faces | Edit |
| Shift+D | Duplicate active object | Object |
| F2 | Rename active object | Any |
| Escape | Cancel active modal / clear annotations or measurements | Any |

**Modal tools** (G/R/S): Move the mouse to transform, click to confirm, Escape to cancel and revert.

**Scale gizmo**: When the Scale tool is active, click on axis handles (X/Y/Z) for single-axis scaling, or click anywhere else for uniform scaling.

## 3MF Export (3D Printing)

Click the green **Export 3MF** button in the header bar to download the scene as a `.3mf` file ready for slicing.

- Works with both WASM scenes and the JS fallback cube
- Deduplicates per-face render vertices back to unique mesh vertices
- Bakes object transforms into world-space positions
- Scales to millimeters (default: 1 Blender unit = 5mm, so the default 2-unit cube exports as 10mm / 1cm)
- Outputs a valid 3MF ZIP archive with `[Content_Types].xml`, `_rels/.rels`, and `3D/3dmodel.model`
- Compatible with Bambu Studio, PrusaSlicer, Cura, and other 3MF-compatible slicers

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
- Renders a scale gizmo with per-axis handles and a uniform circle
- Runs a `requestAnimationFrame` render loop
- Falls back to a static cube when WASM isn't loaded

### 3MF Export Pipeline

`export3mf.ts` handles the full export flow:
1. `extractSceneMeshes()` pulls vertex positions, triangle indices, and transform matrices from each scene object
2. `deduplicateMesh()` collapses per-face-expanded vertices to unique positions, applies the object transform, and scales to millimeters
3. `build3mfModelXml()` generates the 3MF XML with `<vertices>`, `<triangles>`, and `<build>` sections
4. `export3mf()` packages everything into a ZIP via `jszip` and triggers a browser download

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
