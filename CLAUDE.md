# Blender Web Lite — Project Knowledge Base

> **Project**: Trimmed-down Blender running in the browser via WebAssembly + React
> **Repo**: Fork of official Blender (`https://github.com/vaibhavsinha/blender.git`)
> **Status**: WASM module + React app functional — viewport, mesh editing, and toolbar tools working

---

## 1. Repository Notes

This is a **sparse checkout** of the full Blender repository. Source files exist in git
pack objects but are NOT checked out to the working directory. Use `git show HEAD:<path>`
to read any source file. To populate directories for compilation:

```bash
git sparse-checkout set source/blender/blenlib source/blender/blenkernel ...
```

---

## 2. Architecture Overview

### Module Dependency Layers

```
Layer 0 (Standalone):
  blenlib (BLI)         — Utility library (math, containers, strings, file I/O)
  makesdna (DNA)        — Binary serialization, ~200+ struct types

Layer 1 (Core Data):
  blenkernel (BKE)      — Core kernel: BKE_main, BKE_idtype, BKE_global
  blenloader            — .blend file I/O (depends on BLI, DNA, BKE_main)

Layer 2 (Scene):
  BKE_scene, BKE_collection, BKE_layer

Layer 3 (Objects/Geometry):
  BKE_object, BKE_mesh, BKE_camera, BKE_material
  bmesh                 — Half-edge mesh editing (BMVert, BMEdge, BMFace, BMLoop)

Layer 4 (Evaluation):
  depsgraph             — Dependency graph (optional for static viewing)

Layer 5 (Rendering):
  gpu                   — GPU abstraction (OpenGL/Vulkan/Metal backends)
  draw                  — Draw Manager (passes, shading groups, engines)

Layer 6 (Platform):
  GHOST                 — Windowing/event abstraction (intern/ghost/)
  windowmanager (WM)    — Main loop, operators, events, keymaps

Layer 7 (Editors):
  space_view3d          — 3D viewport
  editors/object        — Object mode tools
  editors/mesh          — Mesh editing tools
  editors/transform     — Transform operations
```

### Main Event Loop (`WM_main` in `source/blender/windowmanager/intern/wm.cc`)

```cpp
void WM_main(bContext *C) {
  wm_event_do_refresh_wm_and_depsgraph(C);
  while (true) {
    wm_window_events_process(C);   // GHOST → wmEvent queue
    wm_event_do_handlers(C);       // Dispatch to handlers
    wm_event_do_notifiers(C);      // Process change notifications
    wm_draw_update(C);             // Render frame
  }
}
```

**WASM Critical Change**: This infinite loop must become `emscripten_set_main_loop()` or
`requestAnimationFrame`-based single-iteration callback.

---

## 3. GHOST System (Platform Abstraction)

**Location**: `intern/ghost/`

### Key Interfaces
- `GHOST_ISystem` — Singleton: `createSystem()`, `processEvents()`, `dispatchEvents()`, `createWindow()`
- `GHOST_IWindow` — Window: `getClientBounds()`, `swapBuffers()`, `setDrawingContextType()`
- `GHOST_IContext` — GPU context: `activateDrawingContext()`, `getDefaultFramebuffer()`

### Existing Backends
| Backend | Platform | Notes |
|---------|----------|-------|
| X11 | Linux | GLX contexts |
| Wayland | Linux | Modern, dynamic loading |
| Win32 | Windows | Native API |
| Cocoa | macOS | Obj-C++, Metal/OpenGL |
| **SDL** | Cross-platform | **Best template for Web backend** |
| Headless | All | Null backend for servers |

### Global System Pointer (`wm_window.cc`)
```cpp
static GHOST_ISystem *g_system = nullptr;
// Created in wm_ghost_init(), used everywhere
```

### Drawing Context Types
```cpp
GHOST_kDrawingContextTypeNone
GHOST_kDrawingContextTypeOpenGL   // WITH_OPENGL_BACKEND
GHOST_kDrawingContextTypeVulkan   // WITH_VULKAN_BACKEND
GHOST_kDrawingContextTypeMetal    // __APPLE__ && WITH_METAL_BACKEND
// NO WebGL or WebGPU context type exists
```

### What GHOST_SystemWeb Must Implement
1. **processEvents()** — Convert JS MouseEvent/KeyboardEvent → GHOST_Event, pushEvent()
2. **createWindow()** — Map to HTML canvas element
3. **createOffscreenContext()** — Create WebGL2 context on canvas
4. **getCursorPosition/setCursorPosition** — From JS event data (setCursor limited by browser security)
5. **getMainDisplayDimensions()** — `window.innerWidth/Height`
6. **installTimer/removeTimer** — `setTimeout`/`setInterval`
7. **getCapabilities()** — Mask out: cursor warp, window positioning, desktop sample

---

## 4. GPU Module

**Location**: `source/blender/gpu/`

### Current Backends
- **OpenGL** (`gpu/opengl/`) — Primary, most tested
- **Vulkan** (`gpu/vulkan/`) — Modern, cross-platform
- **Metal** (`gpu/metal/`) — macOS native
- **NO WebGL/WebGPU backend exists**

### Core GPU Abstractions
```
GPUContext       — Active rendering context
GPUBatch         — Geometry batch (vertex + index buffers)
GPUVertBuf       — Vertex buffer
GPUIndexBuf      — Index buffer
GPUShader        — Compiled shader program
GPUFrameBuffer   — Framebuffer object
GPUTexture       — Texture handle
GPUStorageBuf    — Storage buffer (SSBO)
```

### Shader System
- Uses `ShaderCreateInfo` for backend-independent definitions
- Shaders defined in `source/blender/draw/engines/*/shaders/infos/*_info.hh`
- Pipeline: GLSL source → backend-specific compilation

### Strategy Options for Web
| Approach | Effort | Risk |
|----------|--------|------|
| **Emscripten OpenGL→WebGL translation** | Low (~2-4 weeks) | High — many GL calls unsupported in WebGL2 |
| **New WebGL2 GPU backend** | Medium (~6-8 weeks) | Medium — clean but large scope |
| **New WebGPU backend** | High (~10-16 weeks) | Low — future-proof but immature |

**Recommended**: Start with Emscripten's OpenGL-to-WebGL2 translation layer for the
prototype, then assess which calls fail and decide on a dedicated backend.

---

## 5. Draw Manager

**Location**: `source/blender/draw/`

### Draw Engines
| Engine | Purpose | Required? |
|--------|---------|-----------|
| **Workbench** | Solid/material preview viewport shading | YES (simplest) |
| **Overlay** | Wireframe, selection, gizmos, grid | YES |
| EEVEE | PBR real-time rendering | No (too heavy) |
| EEVEE Next | Development version of EEVEE | No |
| External | Custom render engines | No |

### Rendering Pipeline
```
view3d_draw()
  → DRW_draw_render_loop_ex()
    → Engine::draw_scene()     (Workbench/Overlay)
      → DRW_pass_create()
      → DRW_shgroup_create()
      → DRW_shgroup_call_add()
    → DRW_draw_pass()
      → GPU_batch_draw()       (Submit to GPU)
```

---

## 6. Build System

### Key Files
- `CMakeLists.txt` (top-level, ~2955 lines) — 130+ configurable build flags
- `build_files/cmake/config/blender_lite.cmake` — **Minimal build config** (starting point)
- `build_files/cmake/macros.cmake` — `blender_add_lib()`, link multiplicity = 3
- `build_files/cmake/platform/` — Platform-specific configs (unix, apple, win32)

### blender_lite.cmake
Disables almost everything except:
- Python (required for UI)
- Core modifiers (IK, boolean)
- Wayland on Linux

Usage: `cmake -C../blender/build_files/cmake/config/blender_lite.cmake ../blender`

### Required Dependencies (Unconditional)
- Python 3.13+ (if WITH_PYTHON — can potentially disable for WASM)
- JPEG, PNG, ZLIB (image I/O)
- Freetype (font rendering)
- OpenGL (rendering)

### WASM/Emscripten Status
**ZERO existing support.** No mentions of emscripten, wasm, or browser targets anywhere
in the build system. A new platform configuration is needed.

---

## 7. DNA/RNA Systems

### DNA (Data-Name-Array)
- **Location**: `source/blender/makesdna/`
- Binary serialization system, ~200+ struct types
- Every .blend file embeds its DNA for forward/backward compatibility
- `makesdna` tool scans `DNA_*.h` headers → generates serialization code
- **Essential types**: Scene, Object, Mesh, View3D, Screen, Area, Region, RegionView3D, Camera
- For lite build: need ~60-80 types (30-50% of total)

### RNA (Runtime API)
- **Location**: `source/blender/makesrna/`
- API layer over DNA for Python scripting and UI property access
- Generated code from `rna_*.cc` definition files
- **For WASM without Python, RNA could be largely eliminated** — saves significant code
- Essential RNA (if kept): rna_scene, rna_object, rna_mesh, rna_space, rna_view3d

---

## 8. BMesh (Mesh Editing)

**Location**: `source/blender/bmesh/`

- Half-edge data structure: `BMVert`, `BMEdge`, `BMFace`, `BMLoop`
- 40+ operators: extrude, bevel, subdivide, inset, dissolve, etc.
- Conversion: `BM_mesh_bm_from_me()` / `BM_mesh_bm_to_me()`
- Dependencies: blenlib, blenkernel, makesdna — relatively self-contained

---

## 9. Minimal Viable Build Path

### Phase 1: Compile to WASM (Viewport Only)

**Goal**: Render a static 3D mesh in the browser with orbit/zoom navigation.

#### Modules to Include
```
MUST HAVE:
├── blenlib (BLI)              — Utility library
├── makesdna                   — Data structures + generator
├── blenkernel (core subset)   — BKE_main, BKE_context, BKE_scene, BKE_object,
│                                BKE_mesh, BKE_camera, BKE_collection, BKE_global,
│                                BKE_idtype, BKE_screen
├── gpu                        — GPU abstraction (OpenGL backend via Emscripten)
├── draw                       — Workbench + Overlay engines only
├── GHOST (new Web backend)    — GHOST_SystemWeb, GHOST_WindowWeb, GHOST_ContextWeb
├── windowmanager (stripped)    — WM_main loop, basic event dispatch, minimal operators
├── editors/space_view3d       — 3D viewport (view3d_draw, navigation ops)
└── intern/guardedalloc        — Memory allocation

STRIP OUT:
├── Python/RNA                 — No scripting in browser
├── Cycles/EEVEE               — Too heavy for WASM
├── All simulation (fluid, cloth, particles, rigid body)
├── Sequencer, compositor, grease pencil
├── Most file formats (Alembic, USD, FBX)
├── Audio (audaspace)
├── XR/VR support
├── Most editors (UV, node, text, NLA, graph, etc.)
└── Complex modifiers
```

#### Critical Code Changes
1. **New platform: `platform_wasm.cmake`** — Emscripten toolchain, WASM flags
2. **New GHOST backend: `GHOST_SystemWeb`** — Based on SDL backend structure
3. **Main loop conversion**: `WM_main()` infinite loop → `emscripten_set_main_loop_arg()`
4. **Disable Python**: `WITH_PYTHON=OFF` + stub out Python-dependent init code
5. **GPU backend**: Use Emscripten's OpenGL→WebGL2 translation initially
6. **Disable threads**: Browser main thread only (or Web Workers for limited use)

### Phase 2: React Integration

**Goal**: Embed WASM viewport in React app with bidirectional communication.

```
React App
├── <BlenderCanvas />          — Canvas element for WebGL
├── useBlenderWasm() hook      — Load/init WASM module
├── Event bridge               — DOM events → GHOST_SystemWeb
├── Command API                — JS → C++ function calls (via Emscripten bindings)
│   ├── loadMesh(arrayBuffer)
│   ├── setViewpoint(x, y, z)
│   ├── selectObject(id)
│   └── getMeshData() → ArrayBuffer
└── State sync                 — C++ → JS callbacks for UI state
```

### Phase 3: Mesh Editing

**Goal**: Basic mesh editing (select, move, extrude, delete).

Add:
- BMesh library
- editors/mesh (subset)
- editors/transform
- Undo system (minimal)

---

## 10. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| OpenGL calls incompatible with WebGL2 | HIGH | Start with Emscripten's translation, audit failures |
| Circular dependencies break WASM linking | MEDIUM | Link multiplicity already set to 3; use `--whole-archive` |
| Python deeply embedded in init paths | HIGH | Stub out `WITH_PYTHON=OFF` paths; audit `wm_init_exit.cc` |
| WASM binary too large (>50MB) | MEDIUM | Strip debug info, LTO, only link needed modules |
| Shader incompatibilities (GLSL → GLSL ES) | HIGH | Audit ShaderCreateInfo system, add ES 3.0 output path |
| Main thread blocking in browser | HIGH | Convert all blocking loops to async/callback patterns |
| Memory limits (browsers cap at ~2-4GB) | MEDIUM | Use streaming mesh loading, limit scene complexity |

---

## 11. Current Web App Architecture

### Directory Structure
```
web/
├── wasm/                          — C++ WASM module (Emscripten)
│   ├── src/
│   │   ├── mesh.h / mesh.cc      — EditMesh: vertices, faces, selection, transforms, mesh ops
│   │   ├── scene.h               — Scene, Camera, SceneObject (inline implementations)
│   │   └── bindings.cc           — Emscripten embind → JS API
│   ├── CMakeLists.txt            — Emscripten build config
│   └── build/                    — Build output (blender_web.js + .wasm)
└── app/                           — React + Vite frontend
    ├── public/
    │   ├── blender_web.js        — Compiled WASM loader (copied from wasm/build/)
    │   └── blender_web.wasm      — Compiled WASM binary (copied from wasm/build/)
    └── src/
        ├── types/wasm.d.ts       — TS interfaces for WASM module (EditMesh, Camera, Scene, etc.)
        ├── store/sceneStore.ts   — Zustand store (mode, activeTool, mesh stats, status)
        ├── utils/
        │   ├── export3mf.ts      — 3MF export: vertex dedup, XML gen, ZIP packaging, download
        │   └── extractSceneMeshes.ts — Bridge: Scene API → MeshExportData for WASM & fallback
        ├── hooks/
        │   ├── useViewport.ts    — WebGL rendering, orbit/pan/zoom camera
        │   └── useMeshOperations.ts — Mesh ops + modal tool state (grab/rotate/scale)
        └── components/
            ├── App.tsx           — Root layout + export handler wiring
            ├── ViewportCanvas.tsx — WebGL canvas + keyboard/mouse + overlay wrapper
            ├── HeaderBar.tsx     — Top bar: mode buttons + Export 3MF button
            ├── Toolbar.tsx       — Left toolbar with tool icons + active highlighting
            ├── AnnotationOverlay.tsx — 2D freehand drawing overlay
            └── MeasureOverlay.tsx   — Click-to-measure distance overlay
```

### WASM ↔ React Bridge
- **EditMesh** methods exposed via Emscripten `embind`: `selectFace`, `translateSelected`, `rotateSelected`, `scaleSelected`, `extrudeSelectedFaces`, `subdivideSelectedFaces`, `deleteSelectedFaces`, `buildRenderData`
- **Camera** orbital controls: `orbit(dAz, dEl)`, `pan(dx, dy)`, `zoom(delta)`, matrix getters
- **Scene** management: `addCube`, `addPlane`, `getActiveObject`, `getCamera`
- Render data returned as typed arrays (`Float32Array`, `Uint32Array`) — zero-copy to WebGL

### Implemented Toolbar Tools
| Tool | Key | Mode | Implementation |
|------|-----|------|----------------|
| Select | click | Persistent | Face cycling on left click |
| Select All | A | One-shot | `toggleSelectAll()` |
| Grab/Move | G | Modal | Mouse → `translateSelected`, click confirm, Escape cancel |
| Rotate | R | Modal | Mouse dx → Y-axis rotation via quaternion, click/Escape |
| Scale | S / gizmo | Modal | Mouse dx → per-axis or uniform scale via gizmo, click/Escape |
| Extrude | E | One-shot | `extrudeSelectedFaces(0.5)` |
| Subdivide | W | One-shot | `subdivideSelectedFaces()` |
| Delete | X / Del | One-shot | `deleteSelectedFaces()` |
| Annotate | toolbar | Persistent | 2D canvas overlay, freehand white polylines |
| Measure | toolbar | Persistent | 2D canvas overlay, click two points → dashed line + px label |
| Add Cube | toolbar | One-shot | `scene.addCube()` |
| Export 3MF | header btn | One-shot | Downloads `.3mf` ZIP (vertex dedup, XML, jszip) |

### Tool Type (Zustand store)
```typescript
type Tool = "select" | "grab" | "rotate" | "scale" | "annotate" | "measure";
```
Extrude/Subdivide/Delete/Export are one-shot actions, not persistent tool modes.

### Cursor Feedback
Each tool maps to a CSS cursor. Modal overrides: grab active → `grabbing`, rotate active → `grabbing`, scale active → `col-resize`.

### 3MF Export System
- **Format**: 3MF is a ZIP (OPC) archive containing XML describing vertices/triangles
- **Pipeline**: `extractSceneMeshes()` → `deduplicateMesh()` → `build3mfModelXml()` → `jszip` ZIP → browser download
- **Scale**: `DEFAULT_SCALE_MM = 5` (1 Blender unit = 5mm, so default 2-unit cube = 10mm = 1cm)
- **WASM compatibility**: `extractSceneMeshes()` uses `typeof obj.getName === "function"` guard for older WASM builds missing `getName` binding; falls back to `"Object N"`
- **Fallback mode**: When WASM isn't loaded, exports the JS fallback cube geometry via `extractFallbackCubeMesh()`
- **Dependencies**: `jszip` (v3.x, bundles its own TS types)

### Modal Tool Interaction Model
- Modal tools (grab/rotate/scale) use refs (`grabActiveRef`, `rotateActiveRef`, `scaleActiveRef`) for synchronous state
- **Confirmation click**: When clicking to confirm a modal, `isDraggingRef` is cleared to prevent the confirmation click from leaking into camera orbit
- **Scale gizmo**: Clicking on axis handles constrains to that axis; clicking elsewhere defaults to uniform scaling (`?? "uniform"` fallback)
- **Axis constraint**: During active scale modal, pressing X/Y/Z keys constrains to that axis
- **Camera controls during modals**: Left-click is consumed by the modal; middle-mouse orbit and right-mouse pan remain available

---

## 12. Conventions

- **Commits**: Every 30-60 minutes, conventional commit messages
- **Branch**: `claude_code_hackathon` (working branch)
- **Build**: WASM via Emscripten (`emcmake cmake` + `emmake make`), React via Vite
- **Testing**: Vitest (`npm run test:run`), manual browser testing (`npm run dev`)
- **Dependencies**: React 19, Zustand 5, jszip 3 (for 3MF export), Vite 6

---

## 13. Key File Paths

### Web App (checked out, editable)
```
web/wasm/src/mesh.h                              — EditMesh class: vertices, faces, transforms
web/wasm/src/mesh.cc                             — EditMesh implementation
web/wasm/src/scene.h                             — Scene, Camera, SceneObject
web/wasm/src/bindings.cc                         — Emscripten embind JS ↔ C++
web/wasm/CMakeLists.txt                          — WASM build config
web/app/src/types/wasm.d.ts                      — TS types for WASM module
web/app/src/store/sceneStore.ts                  — Zustand store (Tool, EditMode, state)
web/app/src/utils/export3mf.ts                   — 3MF export: dedup, XML, ZIP, download
web/app/src/utils/extractSceneMeshes.ts          — Scene → MeshExportData bridge (WASM + fallback)
web/app/src/hooks/useViewport.ts                 — WebGL rendering + camera controls
web/app/src/hooks/useMeshOperations.ts           — Mesh ops + modal tool state
web/app/src/components/ViewportCanvas.tsx         — Canvas + keyboard/mouse + overlays
web/app/src/components/HeaderBar.tsx              — Top bar: mode buttons + Export 3MF button
web/app/src/components/Toolbar.tsx                — Left toolbar (SVG icons, tool switching)
web/app/src/components/AnnotationOverlay.tsx      — 2D freehand drawing overlay
web/app/src/components/MeasureOverlay.tsx         — Distance measurement overlay
web/app/src/components/App.tsx                    — Root layout + export handler wiring
```

### Blender Source (via `git show HEAD:<path>`)
```
CMakeLists.txt                                          — Top-level build
build_files/cmake/config/blender_lite.cmake             — Minimal build config
build_files/cmake/macros.cmake                          — blender_add_lib() etc.
source/blender/windowmanager/intern/wm.cc               — WM_main() loop
source/blender/windowmanager/intern/wm_window.cc        — GHOST integration
source/blender/windowmanager/intern/wm_init_exit.cc     — WM_init() / WM_exit()
source/blender/windowmanager/intern/wm_event_system.cc  — Event dispatch
source/blender/windowmanager/intern/wm_draw.cc          — Drawing coordination
intern/ghost/GHOST_ISystem.hh                           — System interface
intern/ghost/GHOST_IWindow.hh                           — Window interface
intern/ghost/intern/GHOST_SystemSDL.hh                  — SDL backend (template)
intern/ghost/intern/GHOST_WindowSDL.hh                  — SDL window
source/blender/gpu/GPU_batch.hh                         — GPU batch API
source/blender/draw/DRW_engine.hh                       — Draw engine API
source/blender/makesdna/DNA_scene_types.h               — Scene struct
source/blender/makesdna/DNA_object_types.h              — Object struct
source/blender/makesdna/DNA_mesh_types.h                — Mesh struct
source/blender/editors/space_view3d/space_view3d.cc     — Viewport registration
source/blender/bmesh/bmesh.hh                           — BMesh API
```
## To Run the Project

1. **Without WASM** (immediate): `cd web/app && npm run dev` — renders a fallback cube with full orbit/zoom/pan
2. **With WASM** (requires Emscripten SDK):
   ```bash
   cd web/wasm && mkdir -p build && cd build
   emcmake cmake .. && emmake make -j$(nproc)
   cp blender_web.js blender_web.wasm ../../app/public/
   cd ../../app && npm run dev
   ```
