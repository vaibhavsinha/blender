import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toolbar } from "../Toolbar";
import { useSceneStore } from "../../store/sceneStore";

describe("Toolbar", () => {
  const defaultProps = {
    onExtrude: vi.fn(),
    onSubdivide: vi.fn(),
    onDelete: vi.fn(),
    onToggleSelectAll: vi.fn(),
    onAddCube: vi.fn(),
  };

  beforeEach(() => {
    useSceneStore.setState({
      mode: "edit",
      activeTool: "select",
    });
    vi.clearAllMocks();
  });

  it("renders the 4 main tool buttons", () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByTitle("Select Box")).toBeInTheDocument();
    expect(screen.getByTitle("Move (G)")).toBeInTheDocument();
    expect(screen.getByTitle("Rotate (R)")).toBeInTheDocument();
    expect(screen.getByTitle("Scale (S)")).toBeInTheDocument();
  });

  it("renders Annotate and Measure buttons", () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByTitle("Annotate")).toBeInTheDocument();
    expect(screen.getByTitle("Measure")).toBeInTheDocument();
  });

  it("renders edit mode tools when in edit mode", () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByTitle("Select All (A)")).toBeInTheDocument();
    expect(screen.getByTitle("Extrude (E)")).toBeInTheDocument();
    expect(screen.getByTitle("Subdivide (W)")).toBeInTheDocument();
    expect(screen.getByTitle("Delete (X)")).toBeInTheDocument();
  });

  it("hides edit mode tools in object mode", () => {
    useSceneStore.setState({ mode: "object" });
    render(<Toolbar {...defaultProps} />);
    expect(screen.queryByTitle("Select All (A)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Extrude (E)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Subdivide (W)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete (X)")).not.toBeInTheDocument();
  });

  it("clicking Move sets activeTool to grab", () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Move (G)"));
    expect(useSceneStore.getState().activeTool).toBe("grab");
  });

  it("clicking Rotate sets activeTool to rotate", () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Rotate (R)"));
    expect(useSceneStore.getState().activeTool).toBe("rotate");
  });

  it("clicking Scale sets activeTool to scale", () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Scale (S)"));
    expect(useSceneStore.getState().activeTool).toBe("scale");
  });

  it("clicking Annotate sets activeTool to annotate", () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Annotate"));
    expect(useSceneStore.getState().activeTool).toBe("annotate");
  });

  it("active button has blue highlight background", () => {
    useSceneStore.setState({ activeTool: "grab" });
    render(<Toolbar {...defaultProps} />);
    const moveBtn = screen.getByTitle("Move (G)");
    expect(moveBtn.style.background).toBe("rgb(75, 110, 175)");
  });

  it("inactive button has transparent background", () => {
    render(<Toolbar {...defaultProps} />);
    const rotateBtn = screen.getByTitle("Rotate (R)");
    expect(rotateBtn.style.background).toBe("transparent");
  });

  it("onExtrude callback fires when Extrude clicked", () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Extrude (E)"));
    expect(defaultProps.onExtrude).toHaveBeenCalledOnce();
  });

  it("onDelete callback fires when Delete clicked", () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Delete (X)"));
    expect(defaultProps.onDelete).toHaveBeenCalledOnce();
  });
});
