import { useRef, useEffect, useCallback, useState } from "react";

interface Measurement {
  start: { x: number; y: number };
  end: { x: number; y: number };
  distance: number;
}

interface MeasureOverlayProps {
  active: boolean;
  width: number;
  height: number;
}

function calcDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function MeasureOverlay({ active, width, height }: MeasureOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const previewPointRef = useRef<{ x: number; y: number } | null>(null);

  const drawEndpoint = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, []);

  const drawMeasureLine = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      start: { x: number; y: number },
      end: { x: number; y: number },
      dist: number,
    ) => {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);

      drawEndpoint(ctx, start.x, start.y);
      drawEndpoint(ctx, end.x, end.y);

      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const label = `${Math.round(dist)} px`;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      // Dark outline
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(label, midX, midY - 6);
      // White text
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, midX, midY - 6);
    },
    [drawEndpoint],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const m of measurements) {
      drawMeasureLine(ctx, m.start, m.end, m.distance);
    }

    // Preview line
    if (startPointRef.current && previewPointRef.current) {
      const dist = calcDistance(startPointRef.current, previewPointRef.current);
      drawMeasureLine(ctx, startPointRef.current, previewPointRef.current, dist);
    } else if (startPointRef.current) {
      drawEndpoint(ctx, startPointRef.current.x, startPointRef.current.y);
    }
  }, [measurements, drawMeasureLine, drawEndpoint]);

  useEffect(() => {
    redraw();
  }, [redraw, width, height]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (!startPointRef.current) {
        startPointRef.current = point;
        previewPointRef.current = null;
        redraw();
      } else {
        const dist = calcDistance(startPointRef.current, point);
        setMeasurements((prev) => [
          ...prev,
          { start: startPointRef.current!, end: point, distance: dist },
        ]);
        startPointRef.current = null;
        previewPointRef.current = null;
      }
    },
    [active, redraw],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!active || !startPointRef.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      previewPointRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      redraw();
    },
    [active, redraw],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active) {
        setMeasurements([]);
        startPointRef.current = null;
        previewPointRef.current = null;
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
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    />
  );
}
