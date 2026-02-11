/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — Emscripten bindings */

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "mesh.h"
#include "scene.h"

using namespace emscripten;

/* Helper: copy a float[4][4] matrix to JS Float32Array (column-major for WebGL) */
static val matrix_to_float32(const float mat[4][4])
{
  /* Blender stores matrices row-major, WebGL expects column-major.
   * BLI matrices are [row][col], OpenGL/WebGL expects column-major.
   * Blender's convention: mat[row][col], stored row-major.
   * We need to transpose for WebGL. */
  float transposed[16];
  for (int r = 0; r < 4; r++) {
    for (int c = 0; c < 4; c++) {
      transposed[c * 4 + r] = mat[r][c];
    }
  }
  return val(typed_memory_view(16, transposed)).call<val>("slice");
}

/* Helper: build render data and return as JS object */
static val mesh_build_render_data(EditMesh &mesh)
{
  RenderData rd = mesh.build_render_data();
  val result = val::object();

  result.set("positions",
             val(typed_memory_view(rd.positions.size(), rd.positions.data()))
                 .call<val>("slice"));
  result.set("normals",
             val(typed_memory_view(rd.normals.size(), rd.normals.data())).call<val>("slice"));
  result.set("colors",
             val(typed_memory_view(rd.colors.size(), rd.colors.data())).call<val>("slice"));
  result.set(
      "solidIndices",
      val(typed_memory_view(rd.solid_indices.size(), rd.solid_indices.data()))
          .call<val>("slice"));
  result.set(
      "wireIndices",
      val(typed_memory_view(rd.wire_indices.size(), rd.wire_indices.data()))
          .call<val>("slice"));
  result.set("vertexCount", rd.vertex_count);
  result.set("solidIndexCount", rd.solid_index_count);
  result.set("wireIndexCount", rd.wire_index_count);

  return result;
}

/* Camera matrix helpers */
static val camera_get_view_matrix(Camera &cam)
{
  float mat[4][4];
  cam.get_view_matrix(mat);
  return matrix_to_float32(mat);
}

static val camera_get_projection_matrix(Camera &cam)
{
  float mat[4][4];
  cam.get_projection_matrix(mat);
  return matrix_to_float32(mat);
}

static val camera_get_eye_position(Camera &cam)
{
  float eye[3];
  cam.get_eye_position(eye);
  return val(typed_memory_view(3, eye)).call<val>("slice");
}

/* SceneObject helpers */
static val object_get_transform_matrix(SceneObject &obj)
{
  return matrix_to_float32(obj.transform);
}

static val object_get_location(SceneObject &obj)
{
  return val(typed_memory_view(3, obj.location)).call<val>("slice");
}

static void object_set_location(SceneObject &obj, float x, float y, float z)
{
  obj.location[0] = x;
  obj.location[1] = y;
  obj.location[2] = z;
  obj.update_transform();
}

/* Normal matrix helper (3x3 from 4x4 transform) */
static val object_get_normal_matrix(SceneObject &obj)
{
  /* Extract upper-left 3x3, transpose of inverse for normals.
   * For uniform scale, it's just the upper-left 3x3. */
  float nm[9];
  nm[0] = obj.transform[0][0];
  nm[1] = obj.transform[1][0];
  nm[2] = obj.transform[2][0];
  nm[3] = obj.transform[0][1];
  nm[4] = obj.transform[1][1];
  nm[5] = obj.transform[2][1];
  nm[6] = obj.transform[0][2];
  nm[7] = obj.transform[1][2];
  nm[8] = obj.transform[2][2];
  return val(typed_memory_view(9, nm)).call<val>("slice");
}

EMSCRIPTEN_BINDINGS(blender_web)
{
  /* EditMesh */
  class_<EditMesh>("EditMesh")
      .constructor<>()
      .class_function("createCube", &EditMesh::create_cube)
      .class_function("createPlane", &EditMesh::create_plane)
      .function("vertexCount", &EditMesh::vertex_count)
      .function("faceCount", &EditMesh::face_count)
      .function("selectFace", &EditMesh::select_face)
      .function("deselectFace", &EditMesh::deselect_face)
      .function("selectAll", &EditMesh::select_all)
      .function("deselectAll", &EditMesh::deselect_all)
      .function("toggleSelectAll", &EditMesh::toggle_select_all)
      .function("isFaceSelected", &EditMesh::is_face_selected)
      .function("selectedFaceCount", &EditMesh::selected_face_count)
      .function("translateSelected", &EditMesh::translate_selected)
      .function("extrudeSelectedFaces", &EditMesh::extrude_selected_faces)
      .function("subdivideSelectedFaces", &EditMesh::subdivide_selected_faces)
      .function("deleteSelectedFaces", &EditMesh::delete_selected_faces)
      .function("recalcNormals", &EditMesh::recalc_normals)
      .function("buildRenderData", &mesh_build_render_data);

  /* Camera */
  class_<Camera>("Camera")
      .constructor<>()
      .property("orbitDistance", &Camera::orbit_distance)
      .property("orbitAzimuth", &Camera::orbit_azimuth)
      .property("orbitElevation", &Camera::orbit_elevation)
      .property("fov", &Camera::fov)
      .property("nearClip", &Camera::near_clip)
      .property("farClip", &Camera::far_clip)
      .property("aspectRatio", &Camera::aspect_ratio)
      .function("orbit", &Camera::orbit)
      .function("pan", &Camera::pan)
      .function("zoom", &Camera::zoom)
      .function("getViewMatrix", &camera_get_view_matrix)
      .function("getProjectionMatrix", &camera_get_projection_matrix)
      .function("getEyePosition", &camera_get_eye_position);

  /* SceneObject */
  class_<SceneObject>("SceneObject")
      .constructor<>()
      .function("getMesh", &SceneObject::get_mesh, allow_raw_pointers())
      .function("getTransformMatrix", &object_get_transform_matrix)
      .function("getNormalMatrix", &object_get_normal_matrix)
      .function("getLocation", &object_get_location)
      .function("setLocation", &object_set_location)
      .function("updateTransform", &SceneObject::update_transform)
      .property("selected", &SceneObject::selected);

  /* Scene */
  class_<Scene>("Scene")
      .constructor<>()
      .function("addCube", &Scene::add_cube)
      .function("addPlane", &Scene::add_plane)
      .function("getObject", &Scene::get_object, allow_raw_pointers())
      .function("getActiveObject", &Scene::get_active_object, allow_raw_pointers())
      .function("getCamera", &Scene::get_camera, allow_raw_pointers())
      .function("objectCount", &Scene::object_count)
      .property("activeObjectIndex", &Scene::active_object_index);
}
