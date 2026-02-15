import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deduplicateMesh,
  build3mfModelXml,
  export3mf,
  DEFAULT_SCALE_MM,
  type MeshExportData,
} from "../export3mf";

// Helper: identity 4x4 matrix (column-major)
function identityMatrix(): Float32Array {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

// Helper: build a unit cube with per-face vertices (24 verts, like buildRenderData)
function makeCubeExportData(name = "Cube"): MeshExportData {
  const s = 1;
  const faceVerts = [
    [[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s]],
    [[s,-s,s],[-s,-s,s],[-s,s,s],[s,s,s]],
    [[-s,-s,s],[-s,-s,-s],[-s,s,-s],[-s,s,s]],
    [[s,-s,-s],[s,-s,s],[s,s,s],[s,s,-s]],
    [[-s,-s,s],[s,-s,s],[s,-s,-s],[-s,-s,-s]],
    [[-s,s,-s],[s,s,-s],[s,s,s],[-s,s,s]],
  ];
  const positions: number[] = [];
  const solidIndices: number[] = [];
  let vi = 0;
  for (let fi = 0; fi < 6; fi++) {
    for (let v = 0; v < 4; v++) {
      positions.push(...faceVerts[fi][v]);
    }
    solidIndices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  }
  return {
    name,
    positions: new Float32Array(positions),
    solidIndices: new Uint32Array(solidIndices),
    transformMatrix: identityMatrix(),
  };
}

describe("deduplicateMesh", () => {
  it("deduplicates 24 cube verts down to 8 unique", () => {
    const cube = makeCubeExportData();
    const clean = deduplicateMesh(cube);
    expect(clean.vertices.length / 3).toBe(8);
    expect(clean.triangles.length).toBe(36); // 12 triangles * 3
  });

  it("all remapped indices are within bounds", () => {
    const cube = makeCubeExportData();
    const clean = deduplicateMesh(cube);
    const maxIdx = clean.vertices.length / 3;
    for (let i = 0; i < clean.triangles.length; i++) {
      expect(clean.triangles[i]).toBeLessThan(maxIdx);
      expect(clean.triangles[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("applies translation transform to positions with mm scale", () => {
    const data = makeCubeExportData();
    // Translate +10 on X
    data.transformMatrix[12] = 10;
    const clean = deduplicateMesh(data);
    const S = DEFAULT_SCALE_MM;
    for (let i = 0; i < clean.vertices.length / 3; i++) {
      const x = clean.vertices[i * 3];
      expect(x).toBeGreaterThanOrEqual((-1 + 10) * S);
      expect(x).toBeLessThanOrEqual((1 + 10) * S);
    }
  });

  it("applies object scale transform to positions with mm scale", () => {
    const data = makeCubeExportData();
    // Scale 2x on all axes via transform matrix
    data.transformMatrix[0] = 2;
    data.transformMatrix[5] = 2;
    data.transformMatrix[10] = 2;
    const clean = deduplicateMesh(data);
    const S = DEFAULT_SCALE_MM;
    for (let i = 0; i < clean.vertices.length / 3; i++) {
      const x = clean.vertices[i * 3];
      const y = clean.vertices[i * 3 + 1];
      const z = clean.vertices[i * 3 + 2];
      expect(Math.abs(x)).toBeCloseTo(2 * S, 4);
      expect(Math.abs(y)).toBeCloseTo(2 * S, 4);
      expect(Math.abs(z)).toBeCloseTo(2 * S, 4);
    }
  });

  it("respects custom scaleMM parameter", () => {
    const data = makeCubeExportData();
    const clean = deduplicateMesh(data, 1); // 1 mm per unit, no scaling
    for (let i = 0; i < clean.vertices.length / 3; i++) {
      const x = clean.vertices[i * 3];
      expect(Math.abs(x)).toBeCloseTo(1, 4);
    }
  });

  it("preserves name", () => {
    const data = makeCubeExportData("MyCube");
    const clean = deduplicateMesh(data);
    expect(clean.name).toBe("MyCube");
  });
});

describe("build3mfModelXml", () => {
  it("produces valid XML with correct namespace and units", () => {
    const xml = build3mfModelXml([makeCubeExportData()]);
    expect(xml).toContain('unit="millimeter"');
    expect(xml).toContain('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"');
    expect(xml).toContain('<?xml version="1.0"');
  });

  it("contains vertex and triangle elements", () => {
    const xml = build3mfModelXml([makeCubeExportData()]);
    expect(xml).toContain("<vertex ");
    expect(xml).toContain("<triangle ");
    expect(xml).toContain("<vertices>");
    expect(xml).toContain("<triangles>");
  });

  it("handles multiple objects with distinct IDs", () => {
    const meshes = [makeCubeExportData("A"), makeCubeExportData("B")];
    const xml = build3mfModelXml(meshes);
    expect(xml).toContain('id="1"');
    expect(xml).toContain('id="2"');
    expect(xml).toContain('objectid="1"');
    expect(xml).toContain('objectid="2"');
    expect(xml).toContain('name="A"');
    expect(xml).toContain('name="B"');
  });

  it("escapes XML special characters in names", () => {
    const data = makeCubeExportData('Test <>&"name');
    const xml = build3mfModelXml([data]);
    expect(xml).toContain("Test &lt;&gt;&amp;&quot;name");
    expect(xml).not.toContain('name="Test <');
  });

  it("includes build items for all objects", () => {
    const xml = build3mfModelXml([
      makeCubeExportData("A"),
      makeCubeExportData("B"),
      makeCubeExportData("C"),
    ]);
    expect(xml).toContain('<item objectid="1"');
    expect(xml).toContain('<item objectid="2"');
    expect(xml).toContain('<item objectid="3"');
  });
});

describe("export3mf", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws for empty meshes array", async () => {
    await expect(export3mf([])).rejects.toThrow("No meshes to export");
  });

  it("creates a ZIP with required 3MF files and triggers download", async () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const mockUrl = "blob:mock-url";
    globalThis.URL.createObjectURL = vi.fn(() => mockUrl);
    globalThis.URL.revokeObjectURL = vi.fn();

    // Track the <a> element created for download
    let clickedHref = "";
    let clickedDownload = "";
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(() => {
          clickedHref = (el as HTMLAnchorElement).href || (el as HTMLAnchorElement).getAttribute("href") || "";
          clickedDownload = (el as HTMLAnchorElement).download;
        });
      }
      return el;
    });

    await export3mf([makeCubeExportData()], "test-model.3mf");

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(clickedDownload).toBe("test-model.3mf");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });

  it("ZIP blob contains the 3 required files", async () => {
    // We can verify by importing JSZip and loading the blob
    const { default: JSZip } = await import("jszip");

    globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
    globalThis.URL.revokeObjectURL = vi.fn();

    let capturedBlob: Blob | null = null;
    const origCreateObjectURL = URL.createObjectURL;
    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:test";
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(() => {});
      }
      return el;
    });

    await export3mf([makeCubeExportData()], "test.3mf");

    expect(capturedBlob).not.toBeNull();
    const zip = await JSZip.loadAsync(capturedBlob!);
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("_rels/.rels")).not.toBeNull();
    expect(zip.file("3D/3dmodel.model")).not.toBeNull();
  });
});
