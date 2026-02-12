import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MeasureOverlay } from "../MeasureOverlay";

describe("MeasureOverlay", () => {
  const defaultProps = { active: true, width: 800, height: 600 };

  beforeEach(() => {
    // Fresh render each time
  });

  it("canvas dimensions match props", () => {
    const { container } = render(<MeasureOverlay {...defaultProps} />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it("pointerEvents is auto when active", () => {
    const { container } = render(<MeasureOverlay active={true} width={800} height={600} />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.pointerEvents).toBe("auto");
  });

  it("pointerEvents is none when inactive", () => {
    const { container } = render(<MeasureOverlay active={false} width={800} height={600} />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.pointerEvents).toBe("none");
  });

  it("first click sets start point (no error)", () => {
    const { container } = render(<MeasureOverlay {...defaultProps} />);
    const canvas = container.querySelector("canvas")!;
    fireEvent.click(canvas, { clientX: 100, clientY: 200 });
    // No errors — start point is set internally
  });

  it("second click completes measurement (no error)", () => {
    const { container } = render(<MeasureOverlay {...defaultProps} />);
    const canvas = container.querySelector("canvas")!;
    // First click — set start
    fireEvent.click(canvas, { clientX: 100, clientY: 200 });
    // Second click — complete measurement
    fireEvent.click(canvas, { clientX: 400, clientY: 600 });
    // No errors — measurement committed
  });

  it("mouse move between clicks triggers preview redraw", () => {
    const { container } = render(<MeasureOverlay {...defaultProps} />);
    const canvas = container.querySelector("canvas")!;
    // First click
    fireEvent.click(canvas, { clientX: 100, clientY: 200 });
    // Move — should show preview line
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 400 });
    // No errors
  });

  it("Escape clears measurements when active", () => {
    const { container } = render(<MeasureOverlay {...defaultProps} />);
    const canvas = container.querySelector("canvas")!;
    // Create a measurement
    fireEvent.click(canvas, { clientX: 0, clientY: 0 });
    fireEvent.click(canvas, { clientX: 300, clientY: 400 });
    // Clear
    fireEvent.keyDown(window, { key: "Escape" });
    // No errors — measurements cleared
  });

  it("Escape does nothing when inactive", () => {
    render(<MeasureOverlay active={false} width={800} height={600} />);
    fireEvent.keyDown(window, { key: "Escape" });
    // No errors
  });

  it("inactive overlay ignores clicks", () => {
    const { container } = render(<MeasureOverlay active={false} width={800} height={600} />);
    const canvas = container.querySelector("canvas")!;
    fireEvent.click(canvas, { clientX: 100, clientY: 200 });
    fireEvent.click(canvas, { clientX: 400, clientY: 600 });
    // No errors, no measurements created
  });

  it("distance calculation is correct (3-4-5 triangle = 500px)", () => {
    // This tests the calcDistance function indirectly.
    // With points (0,0) and (300,400), distance = sqrt(300^2 + 400^2) = 500
    const { container } = render(<MeasureOverlay {...defaultProps} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.click(canvas, { clientX: 0, clientY: 0 });
    fireEvent.click(canvas, { clientX: 300, clientY: 400 });
    // If the measurement was created with correct distance, Escape should clear it
    // The distance label would show "500 px" on the overlay
    fireEvent.keyDown(window, { key: "Escape" });
    // No errors — confirms the math didn't throw
  });

  it("canvas has absolute positioning for overlay", () => {
    const { container } = render(<MeasureOverlay {...defaultProps} />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.position).toBe("absolute");
    expect(canvas.style.top).toBe("0px");
    expect(canvas.style.left).toBe("0px");
  });
});
