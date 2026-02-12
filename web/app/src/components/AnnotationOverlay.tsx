import { useRef, useEffect, useCallback, useState } from "react";

interface Stroke {
  points: { x: number; y: number }[];
}

interface AnnotationOverlayProps {
  active: boolean;
  width: number;
  height: number;
}

export function AnnotationOverlay({ active, width, height }: AnnotationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const allStrokes = currentStrokeRef.current
      ? [...strokes, currentStrokeRef.current]
      : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw, width, height]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!active) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = {
      points: [{ x: e.clientX - rect.left, y: e.clientY - rect.top }],
    };
  }, [active]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    currentStrokeRef.current.points.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    redraw();
  }, [redraw]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke.points.length >= 2) {
      setStrokes((prev) => [...prev, stroke]);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active) {
        setStrokes([]);
        currentStrokeRef.current = null;
        isDrawingRef.current = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: active ? "auto" : "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
