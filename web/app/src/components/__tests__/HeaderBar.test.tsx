import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeaderBar } from "../HeaderBar";
import { useSceneStore } from "../../store/sceneStore";

describe("HeaderBar", () => {
  beforeEach(() => {
    useSceneStore.setState({ mode: "edit" });
    vi.clearAllMocks();
  });

  it("renders mode buttons", () => {
    render(<HeaderBar />);
    expect(screen.getByText("Object Mode")).toBeInTheDocument();
    expect(screen.getByText("Edit Mode")).toBeInTheDocument();
  });

  it("renders export button when onExport3mf is provided", () => {
    const onExport = vi.fn();
    render(<HeaderBar onExport3mf={onExport} />);
    expect(screen.getByTitle("Export 3MF")).toBeInTheDocument();
    expect(screen.getByText("Export 3MF")).toBeInTheDocument();
  });

  it("does not render export button when onExport3mf is not provided", () => {
    render(<HeaderBar />);
    expect(screen.queryByTitle("Export 3MF")).not.toBeInTheDocument();
  });

  it("calls onExport3mf when export button is clicked", () => {
    const onExport = vi.fn();
    render(<HeaderBar onExport3mf={onExport} />);
    fireEvent.click(screen.getByTitle("Export 3MF"));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("switching mode updates store", () => {
    render(<HeaderBar />);
    fireEvent.click(screen.getByText("Object Mode"));
    expect(useSceneStore.getState().mode).toBe("object");
    fireEvent.click(screen.getByText("Edit Mode"));
    expect(useSceneStore.getState().mode).toBe("edit");
  });
});
