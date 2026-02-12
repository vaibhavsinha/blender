import { useEffect, useRef, useState } from "react";
import type { BlenderWebModule, Scene } from "../types/wasm";
import { useSceneStore } from "../store/sceneStore";

export function useBlenderWasm() {
  const moduleRef = useRef<BlenderWebModule | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [ready, setReady] = useState(false);
  const { setWasmReady, setStatusMessage, setObjectCount, setActiveObjectIndex } =
    useSceneStore();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStatusMessage("Loading WASM module...");

        // Check if the WASM JS glue file exists before trying to load it
        const probeResp = await fetch("/blender_web.js", { method: "HEAD" });
        if (!probeResp.ok) {
          throw new Error("blender_web.js not found — WASM module not compiled yet");
        }

        // Load WASM module at runtime via script tag
        const createModule = await new Promise<() => Promise<BlenderWebModule>>(
          (resolve, reject) => {
            const script = document.createElement("script");
            script.src = "/blender_web.js";
            script.onload = () => {
              const factory = (window as unknown as Record<string, unknown>)[
                "createBlenderWeb"
              ] as () => Promise<BlenderWebModule>;
              if (factory) {
                resolve(factory);
              } else {
                reject(new Error("createBlenderWeb not found on window"));
              }
            };
            script.onerror = () => reject(new Error("Failed to load blender_web.js"));
            document.head.appendChild(script);
          },
        );
        const mod = await createModule();

        if (cancelled) return;

        moduleRef.current = mod;

        // Create initial scene with a cube
        const scene = new mod.Scene();
        scene.addCube(2.0);
        sceneRef.current = scene;

        setObjectCount(scene.objectCount());
        setActiveObjectIndex(scene.activeObjectIndex);
        setWasmReady(true);
        setStatusMessage("Ready");
        setReady(true);
      } catch {
        // WASM not available — fall through to JS fallback silently
        if (!cancelled) {
          setStatusMessage("Running with JS fallback (WASM module not built)");
          setReady(true);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return { module: moduleRef, scene: sceneRef, ready };
}
