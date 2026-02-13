/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — Custom EditMesh */

#include "mesh.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <map>
#include <unordered_map>

#include "BLI_math_rotation.h"
#include "BLI_math_vector.h"

using namespace blender;

/* -------------------------------------------------------------------- */
/** \name Helpers
 * \{ */

uint32_t EditMesh::add_vertex(float x, float y, float z)
{
  Vertex v;
  v.position[0] = x;
  v.position[1] = y;
  v.position[2] = z;
  v.normal[0] = v.normal[1] = v.normal[2] = 0.0f;
  v.flags = MESH_FLAG_NONE;
  vertices.push_back(v);
  return (uint32_t)(vertices.size() - 1);
}

void EditMesh::add_quad(uint32_t a, uint32_t b, uint32_t c, uint32_t d)
{
  Face f;
  f.indices[0] = a;
  f.indices[1] = b;
  f.indices[2] = c;
  f.indices[3] = d;
  f.vert_count = 4;
  f.flags = MESH_FLAG_NONE;
  compute_face_normal(f);
  faces.push_back(f);
}

void EditMesh::add_tri(uint32_t a, uint32_t b, uint32_t c)
{
  Face f;
  f.indices[0] = a;
  f.indices[1] = b;
  f.indices[2] = c;
  f.indices[3] = 0;
  f.vert_count = 3;
  f.flags = MESH_FLAG_NONE;
  compute_face_normal(f);
  faces.push_back(f);
}

void EditMesh::compute_face_normal(Face &face) const
{
  if (face.vert_count < 3) {
    zero_v3(face.normal);
    return;
  }
  const float *v0 = vertices[face.indices[0]].position;
  const float *v1 = vertices[face.indices[1]].position;
  const float *v2 = vertices[face.indices[2]].position;

  float e1[3], e2[3];
  sub_v3_v3v3(e1, v1, v0);
  sub_v3_v3v3(e2, v2, v0);
  cross_v3_v3v3(face.normal, e1, e2);
  normalize_v3(face.normal);
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Primitives
 * \{ */

EditMesh EditMesh::create_cube(float size)
{
  EditMesh mesh;
  float s = size * 0.5f;

  /* 8 vertices of a cube centered at origin */
  mesh.add_vertex(-s, -s, -s); /* 0: back-bottom-left */
  mesh.add_vertex(s, -s, -s);  /* 1: back-bottom-right */
  mesh.add_vertex(s, s, -s);   /* 2: back-top-right */
  mesh.add_vertex(-s, s, -s);  /* 3: back-top-left */
  mesh.add_vertex(-s, -s, s);  /* 4: front-bottom-left */
  mesh.add_vertex(s, -s, s);   /* 5: front-bottom-right */
  mesh.add_vertex(s, s, s);    /* 6: front-top-right */
  mesh.add_vertex(-s, s, s);   /* 7: front-top-left */

  /* 6 faces (CCW winding for outward normals) */
  mesh.add_quad(0, 1, 2, 3); /* back  (-Z) */
  mesh.add_quad(5, 4, 7, 6); /* front (+Z) */
  mesh.add_quad(4, 0, 3, 7); /* left  (-X) */
  mesh.add_quad(1, 5, 6, 2); /* right (+X) */
  mesh.add_quad(4, 5, 1, 0); /* bottom(-Y) */
  mesh.add_quad(3, 2, 6, 7); /* top   (+Y) */

  mesh.recalc_normals();
  return mesh;
}

EditMesh EditMesh::create_plane(float size)
{
  EditMesh mesh;
  float s = size * 0.5f;

  mesh.add_vertex(-s, -s, 0.0f);
  mesh.add_vertex(s, -s, 0.0f);
  mesh.add_vertex(s, s, 0.0f);
  mesh.add_vertex(-s, s, 0.0f);

  mesh.add_quad(0, 1, 2, 3);
  mesh.recalc_normals();
  return mesh;
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Selection
 * \{ */

void EditMesh::select_face(int index)
{
  if (index >= 0 && index < (int)faces.size()) {
    faces[index].flags |= MESH_FLAG_SELECT;
  }
}

void EditMesh::deselect_face(int index)
{
  if (index >= 0 && index < (int)faces.size()) {
    faces[index].flags &= ~MESH_FLAG_SELECT;
  }
}

void EditMesh::select_all()
{
  for (auto &f : faces) {
    f.flags |= MESH_FLAG_SELECT;
  }
}

void EditMesh::deselect_all()
{
  for (auto &f : faces) {
    f.flags &= ~MESH_FLAG_SELECT;
  }
}

void EditMesh::toggle_select_all()
{
  if (selected_face_count() > 0) {
    deselect_all();
  }
  else {
    select_all();
  }
}

void EditMesh::invert_selection()
{
  for (auto &f : faces) {
    f.flags ^= MESH_FLAG_SELECT;
  }
}

bool EditMesh::is_face_selected(int index) const
{
  if (index >= 0 && index < (int)faces.size()) {
    return (faces[index].flags & MESH_FLAG_SELECT) != 0;
  }
  return false;
}

int EditMesh::selected_face_count() const
{
  int count = 0;
  for (const auto &f : faces) {
    if (f.flags & MESH_FLAG_SELECT) {
      count++;
    }
  }
  return count;
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Transform
 * \{ */

void EditMesh::translate_selected(float dx, float dy, float dz)
{
  /* Collect vertices used by selected faces */
  std::vector<bool> affected(vertices.size(), false);
  for (const auto &f : faces) {
    if (!(f.flags & MESH_FLAG_SELECT)) {
      continue;
    }
    for (int i = 0; i < f.vert_count; i++) {
      affected[f.indices[i]] = true;
    }
  }

  float offset[3] = {dx, dy, dz};
  for (size_t i = 0; i < vertices.size(); i++) {
    if (affected[i]) {
      add_v3_v3(vertices[i].position, offset);
    }
  }

  /* Update normals of affected faces */
  for (auto &f : faces) {
    if (f.flags & MESH_FLAG_SELECT) {
      compute_face_normal(f);
    }
  }
}

void EditMesh::rotate_selected(float axis_x, float axis_y, float axis_z, float angle_radians)
{
  /* Collect vertices used by selected faces */
  std::vector<bool> affected(vertices.size(), false);
  for (const auto &f : faces) {
    if (!(f.flags & MESH_FLAG_SELECT)) {
      continue;
    }
    for (int i = 0; i < f.vert_count; i++) {
      affected[f.indices[i]] = true;
    }
  }

  /* Compute centroid of affected vertices */
  float centroid[3] = {0.0f, 0.0f, 0.0f};
  int count = 0;
  for (size_t i = 0; i < vertices.size(); i++) {
    if (affected[i]) {
      add_v3_v3(centroid, vertices[i].position);
      count++;
    }
  }
  if (count == 0) {
    return;
  }
  mul_v3_fl(centroid, 1.0f / (float)count);

  /* Build quaternion from axis-angle */
  float axis[3] = {axis_x, axis_y, axis_z};
  normalize_v3(axis);
  float q[4];
  axis_angle_to_quat(q, axis, angle_radians);

  /* Rotate each affected vertex around centroid */
  for (size_t i = 0; i < vertices.size(); i++) {
    if (!affected[i]) {
      continue;
    }
    float rel[3];
    sub_v3_v3v3(rel, vertices[i].position, centroid);
    mul_qt_v3(q, rel);
    add_v3_v3v3(vertices[i].position, centroid, rel);
  }

  /* Update normals */
  for (auto &f : faces) {
    if (f.flags & MESH_FLAG_SELECT) {
      compute_face_normal(f);
    }
  }
}

void EditMesh::scale_selected(float sx, float sy, float sz)
{
  /* Collect vertices used by selected faces */
  std::vector<bool> affected(vertices.size(), false);
  for (const auto &f : faces) {
    if (!(f.flags & MESH_FLAG_SELECT)) {
      continue;
    }
    for (int i = 0; i < f.vert_count; i++) {
      affected[f.indices[i]] = true;
    }
  }

  /* Compute centroid of affected vertices */
  float centroid[3] = {0.0f, 0.0f, 0.0f};
  int count = 0;
  for (size_t i = 0; i < vertices.size(); i++) {
    if (affected[i]) {
      add_v3_v3(centroid, vertices[i].position);
      count++;
    }
  }
  if (count == 0) {
    return;
  }
  mul_v3_fl(centroid, 1.0f / (float)count);

  /* Scale each affected vertex's offset from centroid */
  for (size_t i = 0; i < vertices.size(); i++) {
    if (!affected[i]) {
      continue;
    }
    float rel[3];
    sub_v3_v3v3(rel, vertices[i].position, centroid);
    rel[0] *= sx;
    rel[1] *= sy;
    rel[2] *= sz;
    add_v3_v3v3(vertices[i].position, centroid, rel);
  }

  /* Update normals */
  for (auto &f : faces) {
    if (f.flags & MESH_FLAG_SELECT) {
      compute_face_normal(f);
    }
  }
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Mesh Operations
 * \{ */

void EditMesh::extrude_selected_faces(float distance)
{
  if (selected_face_count() == 0) {
    return;
  }

  /* For each selected face: duplicate vertices, offset along face normal,
   * create side faces, replace original face indices with new verts. */
  int orig_face_count = (int)faces.size();

  for (int fi = 0; fi < orig_face_count; fi++) {
    Face &face = faces[fi];
    if (!(face.flags & MESH_FLAG_SELECT)) {
      continue;
    }

    int n = face.vert_count;
    uint32_t old_indices[4];
    uint32_t new_indices[4];

    for (int i = 0; i < n; i++) {
      old_indices[i] = face.indices[i];
    }

    /* Duplicate vertices offset along the face normal */
    for (int i = 0; i < n; i++) {
      const Vertex &sv = vertices[old_indices[i]];
      float new_pos[3];
      copy_v3_v3(new_pos, sv.position);
      madd_v3_v3fl(new_pos, face.normal, distance);
      new_indices[i] = add_vertex(new_pos[0], new_pos[1], new_pos[2]);
    }

    /* Create side faces (quads connecting old and new edges) */
    for (int i = 0; i < n; i++) {
      int j = (i + 1) % n;
      add_quad(old_indices[i], old_indices[j], new_indices[j], new_indices[i]);
    }

    /* Update original face to use new vertices (the "cap") */
    for (int i = 0; i < n; i++) {
      face.indices[i] = new_indices[i];
    }
    compute_face_normal(face);
  }

  recalc_normals();
}

void EditMesh::subdivide_selected_faces()
{
  if (selected_face_count() == 0) {
    return;
  }

  /* Simple face subdivision: for each selected quad, split into 4 quads
   * by adding edge midpoints and a face center. */
  int orig_face_count = (int)faces.size();
  std::vector<int> faces_to_remove;

  /* Cache for edge midpoints to avoid duplicates: key = (min_idx, max_idx) */
  std::map<std::pair<uint32_t, uint32_t>, uint32_t> edge_midpoints;

  auto get_midpoint = [&](uint32_t a, uint32_t b) -> uint32_t {
    auto key = std::make_pair(std::min(a, b), std::max(a, b));
    auto it = edge_midpoints.find(key);
    if (it != edge_midpoints.end()) {
      return it->second;
    }
    float mid[3];
    mid_v3_v3v3(mid, vertices[a].position, vertices[b].position);
    uint32_t idx = add_vertex(mid[0], mid[1], mid[2]);
    edge_midpoints[key] = idx;
    return idx;
  };

  for (int fi = 0; fi < orig_face_count; fi++) {
    const Face &face = faces[fi];
    if (!(face.flags & MESH_FLAG_SELECT)) {
      continue;
    }

    faces_to_remove.push_back(fi);

    if (face.vert_count == 4) {
      uint32_t v0 = face.indices[0], v1 = face.indices[1];
      uint32_t v2 = face.indices[2], v3 = face.indices[3];

      /* Edge midpoints */
      uint32_t m01 = get_midpoint(v0, v1);
      uint32_t m12 = get_midpoint(v1, v2);
      uint32_t m23 = get_midpoint(v2, v3);
      uint32_t m30 = get_midpoint(v3, v0);

      /* Face center */
      float center[3];
      zero_v3(center);
      add_v3_v3(center, vertices[v0].position);
      add_v3_v3(center, vertices[v1].position);
      add_v3_v3(center, vertices[v2].position);
      add_v3_v3(center, vertices[v3].position);
      mul_v3_fl(center, 0.25f);
      uint32_t vc = add_vertex(center[0], center[1], center[2]);

      /* 4 new quads */
      add_quad(v0, m01, vc, m30);
      add_quad(m01, v1, m12, vc);
      add_quad(vc, m12, v2, m23);
      add_quad(m30, vc, m23, v3);

      /* Mark new faces as selected */
      for (int i = (int)faces.size() - 4; i < (int)faces.size(); i++) {
        faces[i].flags |= MESH_FLAG_SELECT;
      }
    }
    else if (face.vert_count == 3) {
      uint32_t v0 = face.indices[0], v1 = face.indices[1], v2 = face.indices[2];

      uint32_t m01 = get_midpoint(v0, v1);
      uint32_t m12 = get_midpoint(v1, v2);
      uint32_t m20 = get_midpoint(v2, v0);

      /* 4 new triangles */
      add_tri(v0, m01, m20);
      add_tri(m01, v1, m12);
      add_tri(m20, m12, v2);
      add_tri(m01, m12, m20);

      for (int i = (int)faces.size() - 4; i < (int)faces.size(); i++) {
        faces[i].flags |= MESH_FLAG_SELECT;
      }
    }
  }

  /* Remove original faces (in reverse order to preserve indices) */
  std::sort(faces_to_remove.rbegin(), faces_to_remove.rend());
  for (int idx : faces_to_remove) {
    faces.erase(faces.begin() + idx);
  }

  recalc_normals();
}

void EditMesh::delete_selected_faces()
{
  /* Remove selected faces */
  faces.erase(std::remove_if(faces.begin(),
                              faces.end(),
                              [](const Face &f) { return (f.flags & MESH_FLAG_SELECT) != 0; }),
              faces.end());

  /* Remove orphaned vertices */
  std::vector<bool> used(vertices.size(), false);
  for (const auto &f : faces) {
    for (int i = 0; i < f.vert_count; i++) {
      used[f.indices[i]] = true;
    }
  }

  /* Build index remapping */
  std::vector<uint32_t> remap(vertices.size(), UINT32_MAX);
  uint32_t new_idx = 0;
  for (size_t i = 0; i < vertices.size(); i++) {
    if (used[i]) {
      remap[i] = new_idx++;
    }
  }

  /* Compact vertices */
  std::vector<Vertex> new_verts;
  new_verts.reserve(new_idx);
  for (size_t i = 0; i < vertices.size(); i++) {
    if (used[i]) {
      new_verts.push_back(vertices[i]);
    }
  }
  vertices = std::move(new_verts);

  /* Update face indices */
  for (auto &f : faces) {
    for (int i = 0; i < f.vert_count; i++) {
      f.indices[i] = remap[f.indices[i]];
    }
  }
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Shading
 * \{ */

void EditMesh::set_shade_smooth(bool smooth)
{
  smooth_shading = smooth;
  recalc_normals();
}

bool EditMesh::get_shade_smooth() const
{
  return smooth_shading;
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Normals
 * \{ */

void EditMesh::recalc_normals()
{
  /* Recompute face normals */
  for (auto &f : faces) {
    compute_face_normal(f);
  }

  /* Accumulate face normals to vertex normals (area-weighted by cross product magnitude) */
  for (auto &v : vertices) {
    zero_v3(v.normal);
  }

  for (const auto &f : faces) {
    for (int i = 0; i < f.vert_count; i++) {
      add_v3_v3(vertices[f.indices[i]].normal, f.normal);
    }
  }

  for (auto &v : vertices) {
    normalize_v3(v.normal);
  }
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Render Data
 * \{ */

RenderData EditMesh::build_render_data() const
{
  RenderData rd;

  /* For solid rendering: triangulate faces, with per-face flat normals and selection colors */
  /* We duplicate vertices per-face for flat shading */
  uint32_t vert_offset = 0;

  for (const auto &f : faces) {
    bool selected = (f.flags & MESH_FLAG_SELECT) != 0;
    float r = selected ? 1.0f : 0.5f;
    float g = selected ? 0.55f : 0.5f;
    float b = selected ? 0.0f : 0.5f;

    /* Add face vertices with face normal (flat) or vertex normal (smooth) */
    for (int i = 0; i < f.vert_count; i++) {
      const Vertex &v = vertices[f.indices[i]];
      rd.positions.push_back(v.position[0]);
      rd.positions.push_back(v.position[1]);
      rd.positions.push_back(v.position[2]);
      if (smooth_shading) {
        rd.normals.push_back(v.normal[0]);
        rd.normals.push_back(v.normal[1]);
        rd.normals.push_back(v.normal[2]);
      }
      else {
        rd.normals.push_back(f.normal[0]);
        rd.normals.push_back(f.normal[1]);
        rd.normals.push_back(f.normal[2]);
      }
      rd.colors.push_back(r);
      rd.colors.push_back(g);
      rd.colors.push_back(b);
    }

    /* Triangulate: fan from first vertex */
    for (int i = 1; i < f.vert_count - 1; i++) {
      rd.solid_indices.push_back(vert_offset);
      rd.solid_indices.push_back(vert_offset + i);
      rd.solid_indices.push_back(vert_offset + i + 1);
    }

    /* Wireframe edges */
    for (int i = 0; i < f.vert_count; i++) {
      rd.wire_indices.push_back(vert_offset + i);
      rd.wire_indices.push_back(vert_offset + (i + 1) % f.vert_count);
    }

    vert_offset += f.vert_count;
  }

  rd.vertex_count = (int)(rd.positions.size() / 3);
  rd.solid_index_count = (int)rd.solid_indices.size();
  rd.wire_index_count = (int)rd.wire_indices.size();
  return rd;
}

/** \} */
