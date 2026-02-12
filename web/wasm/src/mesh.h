/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — Custom EditMesh */

#pragma once

#include <cstdint>
#include <vector>

#include "BLI_math_vector.h"

/* Vertex/face flags */
enum MeshFlags : uint32_t {
  MESH_FLAG_NONE = 0,
  MESH_FLAG_SELECT = (1 << 0),
  MESH_FLAG_HIDDEN = (1 << 1),
};

struct Vertex {
  float position[3];
  float normal[3];
  uint32_t flags;
};

struct Face {
  uint32_t indices[4]; /* max 4 verts (quad); triangles use vert_count=3 */
  float normal[3];
  uint32_t flags;
  uint8_t vert_count; /* 3 or 4 */
};

/* Flat arrays ready for WebGL upload */
struct RenderData {
  std::vector<float> positions;  /* 3 floats per vertex */
  std::vector<float> normals;    /* 3 floats per vertex */
  std::vector<float> colors;     /* 3 floats per vertex (selection color) */
  std::vector<uint32_t> solid_indices;
  std::vector<uint32_t> wire_indices;
  int vertex_count;
  int solid_index_count;
  int wire_index_count;
};

class EditMesh {
 public:
  std::vector<Vertex> vertices;
  std::vector<Face> faces;

  EditMesh() = default;

  /* Primitives */
  static EditMesh create_cube(float size);
  static EditMesh create_plane(float size);

  /* Selection */
  void select_face(int index);
  void deselect_face(int index);
  void select_all();
  void deselect_all();
  void toggle_select_all();
  bool is_face_selected(int index) const;
  int selected_face_count() const;

  /* Transform */
  void translate_selected(float dx, float dy, float dz);

  /* Mesh operations */
  void extrude_selected_faces(float distance);
  void subdivide_selected_faces();
  void delete_selected_faces();

  /* Normals */
  void recalc_normals();

  /* Rendering */
  RenderData build_render_data() const;

  /* Accessors */
  int vertex_count() const { return (int)vertices.size(); }
  int face_count() const { return (int)faces.size(); }

 private:
  void compute_face_normal(Face &face) const;
  uint32_t add_vertex(float x, float y, float z);
  void add_quad(uint32_t a, uint32_t b, uint32_t c, uint32_t d);
  void add_tri(uint32_t a, uint32_t b, uint32_t c);
};
