import JSZip from "jszip";

export interface MeshExportData {
  name: string;
  positions: Float32Array;
  solidIndices: Uint32Array;
  transformMatrix: Float32Array; // 4x4 column-major
}

interface CleanMesh {
  name: string;
  vertices: Float32Array; // x,y,z triples (unique, world-space)
  triangles: Uint32Array; // v1,v2,v3 triples (remapped indices)
}

/** mm per Blender unit — makes the default 2-unit cube export as 10mm (1 cm). */
export const DEFAULT_SCALE_MM = 5;

/**
 * Deduplicate vertices that were expanded per-face for rendering.
 * Applies the object's 4x4 transform to bake world-space positions,
 * then scales by `scaleMM` to convert Blender units to millimeters.
 */
export function deduplicateMesh(data: MeshExportData, scaleMM: number = DEFAULT_SCALE_MM): CleanMesh {
  const { positions, solidIndices, transformMatrix: m } = data;
  const vertCount = positions.length / 3;

  const uniqueMap = new Map<string, number>();
  const uniqueVerts: number[] = [];
  const remappedIndices = new Uint32Array(solidIndices.length);

  // Build old-vertex-index → new-unique-index mapping
  const oldToNew = new Uint32Array(vertCount);

  for (let i = 0; i < vertCount; i++) {
    const ox = positions[i * 3];
    const oy = positions[i * 3 + 1];
    const oz = positions[i * 3 + 2];

    // Apply 4x4 column-major transform, then scale to mm
    const wx = (m[0] * ox + m[4] * oy + m[8] * oz + m[12]) * scaleMM;
    const wy = (m[1] * ox + m[5] * oy + m[9] * oz + m[13]) * scaleMM;
    const wz = (m[2] * ox + m[6] * oy + m[10] * oz + m[14]) * scaleMM;

    const key = `${wx.toFixed(6)},${wy.toFixed(6)},${wz.toFixed(6)}`;
    let idx = uniqueMap.get(key);
    if (idx === undefined) {
      idx = uniqueVerts.length / 3;
      uniqueMap.set(key, idx);
      uniqueVerts.push(wx, wy, wz);
    }
    oldToNew[i] = idx;
  }

  // Remap triangle indices
  for (let i = 0; i < solidIndices.length; i++) {
    remappedIndices[i] = oldToNew[solidIndices[i]];
  }

  return {
    name: data.name,
    vertices: new Float32Array(uniqueVerts),
    triangles: remappedIndices,
  };
}

/**
 * Build 3MF model XML from mesh data.
 */
export function build3mfModelXml(meshes: MeshExportData[], scaleMM: number = DEFAULT_SCALE_MM): string {
  const cleaned = meshes.map((m) => deduplicateMesh(m, scaleMM));

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n`;
  xml += `  <resources>\n`;

  for (let oi = 0; oi < cleaned.length; oi++) {
    const mesh = cleaned[oi];
    const objId = oi + 1;
    xml += `    <object id="${objId}" type="model" name="${escapeXml(mesh.name)}">\n`;
    xml += `      <mesh>\n`;
    xml += `        <vertices>\n`;
    const vc = mesh.vertices.length / 3;
    for (let i = 0; i < vc; i++) {
      xml += `          <vertex x="${mesh.vertices[i * 3]}" y="${mesh.vertices[i * 3 + 1]}" z="${mesh.vertices[i * 3 + 2]}" />\n`;
    }
    xml += `        </vertices>\n`;
    xml += `        <triangles>\n`;
    const tc = mesh.triangles.length / 3;
    for (let i = 0; i < tc; i++) {
      xml += `          <triangle v1="${mesh.triangles[i * 3]}" v2="${mesh.triangles[i * 3 + 1]}" v3="${mesh.triangles[i * 3 + 2]}" />\n`;
    }
    xml += `        </triangles>\n`;
    xml += `      </mesh>\n`;
    xml += `    </object>\n`;
  }

  xml += `  </resources>\n`;
  xml += `  <build>\n`;
  for (let oi = 0; oi < cleaned.length; oi++) {
    xml += `    <item objectid="${oi + 1}" />\n`;
  }
  xml += `  </build>\n`;
  xml += `</model>`;

  return xml;
}

/**
 * Export meshes as a .3mf file and trigger browser download.
 */
export async function export3mf(
  meshes: MeshExportData[],
  filename: string = "model.3mf",
): Promise<void> {
  if (meshes.length === 0) {
    throw new Error("No meshes to export");
  }

  const modelXml = build3mfModelXml(meshes);

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n` +
    `</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rels);
  zip.file("3D/3dmodel.model", modelXml);

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
