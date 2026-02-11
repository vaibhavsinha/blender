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

        // Dynamic import of the WASM module
        const createModule = (await import("/blender_web.js")).default;
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
      } catch (err) {
        console.error("Failed to load WASM module:", err);
        setStatusMessage(
          `WASM load failed: ${err instanceof Error ? err.message : "Unknown error"}. Using JS fallback.`
        );
        // Continue without WASM — we'll use a JS fallback
        setReady(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return { module: moduleRef, scene: sceneRef, ready };
}
