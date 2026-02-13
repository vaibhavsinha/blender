/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — Scene + Camera */

#pragma once

#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "mesh.h"

#include "BLI_math_geom.h"
#include "BLI_math_matrix.h"
#include "BLI_math_rotation.h"
#include "BLI_math_vector.h"

using namespace blender;

struct Camera {
  float orbit_distance;
  float orbit_azimuth;   /* radians, around Y axis */
  float orbit_elevation; /* radians, up/down */
  float target[3];
  float fov;       /* vertical FOV in radians */
  float near_clip;
  float far_clip;
  float aspect_ratio;

  Camera()
  {
    orbit_distance = 6.0f;
    orbit_azimuth = 0.78f;  /* ~45 degrees */
    orbit_elevation = 0.52f; /* ~30 degrees */
    zero_v3(target);
    fov = 0.785f; /* ~45 degrees */
    near_clip = 0.1f;
    far_clip = 1000.0f;
    aspect_ratio = 16.0f / 9.0f;
  }

  void orbit(float d_azimuth, float d_elevation)
  {
    orbit_azimuth += d_azimuth;
    orbit_elevation += d_elevation;
    /* Clamp elevation to avoid gimbal lock */
    if (orbit_elevation > 1.5f) {
      orbit_elevation = 1.5f;
    }
    if (orbit_elevation < -1.5f) {
      orbit_elevation = -1.5f;
    }
  }

  void pan(float dx, float dy)
  {
    /* Pan in view-space: compute right and up vectors from azimuth/elevation */
    float cos_az = cosf(orbit_azimuth), sin_az = sinf(orbit_azimuth);
    float right[3] = {cos_az, 0.0f, sin_az};
    float up[3] = {0.0f, 1.0f, 0.0f};
    madd_v3_v3fl(target, right, -dx * orbit_distance * 0.002f);
    madd_v3_v3fl(target, up, -dy * orbit_distance * 0.002f);
  }

  void zoom(float delta)
  {
    orbit_distance *= (1.0f - delta * 0.1f);
    if (orbit_distance < 0.1f) {
      orbit_distance = 0.1f;
    }
    if (orbit_distance > 500.0f) {
      orbit_distance = 500.0f;
    }
  }

  void get_eye_position(float out[3]) const
  {
    float cos_el = cosf(orbit_elevation), sin_el = sinf(orbit_elevation);
    float cos_az = cosf(orbit_azimuth), sin_az = sinf(orbit_azimuth);
    out[0] = target[0] + orbit_distance * cos_el * sinf(orbit_azimuth);
    out[1] = target[1] + orbit_distance * sin_el;
    out[2] = target[2] + orbit_distance * cos_el * cosf(orbit_azimuth);
  }

  void get_view_matrix(float out[4][4]) const
  {
    float eye[3];
    get_eye_position(eye);
    float up[3] = {0.0f, 1.0f, 0.0f};

    /* Use BLI lookat_m4 — parameters: (mat, eye, target, up) */
    /* BLI's lookat_m4 has signature: lookat_m4(float mat[4][4], eye, tar, up) */
    /* Build manually since BLI lookat might not match GL convention exactly */
    float f[3], s[3], u[3];
    sub_v3_v3v3(f, target, eye);
    normalize_v3(f);
    cross_v3_v3v3(s, f, up);
    normalize_v3(s);
    cross_v3_v3v3(u, s, f);

    unit_m4(out);
    out[0][0] = s[0];  out[1][0] = s[1];  out[2][0] = s[2];
    out[0][1] = u[0];  out[1][1] = u[1];  out[2][1] = u[2];
    out[0][2] = -f[0]; out[1][2] = -f[1]; out[2][2] = -f[2];
    out[3][0] = -dot_v3v3(s, eye);
    out[3][1] = -dot_v3v3(u, eye);
    out[3][2] = dot_v3v3(f, eye);
  }

  void get_projection_matrix(float out[4][4]) const
  {
    perspective_m4(out,
                   -near_clip * tanf(fov * 0.5f) * aspect_ratio,
                    near_clip * tanf(fov * 0.5f) * aspect_ratio,
                   -near_clip * tanf(fov * 0.5f),
                    near_clip * tanf(fov * 0.5f),
                    near_clip,
                    far_clip);
  }
};

struct SceneObject {
  std::unique_ptr<EditMesh> mesh;
  std::string name;
  float location[3];
  float rotation[4]; /* quaternion (w, x, y, z) */
  float scale[3];
  float transform[4][4];
  bool selected;

  SceneObject() : name("Object")
  {
    zero_v3(location);
    rotation[0] = 1.0f;
    rotation[1] = rotation[2] = rotation[3] = 0.0f;
    scale[0] = scale[1] = scale[2] = 1.0f;
    unit_m4(transform);
    selected = false;
  }

  void update_transform()
  {
    float rot_mat[4][4], scale_mat[4][4], loc_mat[4][4], temp[4][4];

    /* Rotation */
    quat_to_mat4(rot_mat, rotation);

    /* Scale */
    unit_m4(scale_mat);
    scale_mat[0][0] = scale[0];
    scale_mat[1][1] = scale[1];
    scale_mat[2][2] = scale[2];

    /* Location */
    unit_m4(loc_mat);
    loc_mat[3][0] = location[0];
    loc_mat[3][1] = location[1];
    loc_mat[3][2] = location[2];

    /* transform = loc * rot * scale */
    mul_m4_m4m4(temp, rot_mat, scale_mat);
    mul_m4_m4m4(transform, loc_mat, temp);
  }

  EditMesh *get_mesh() { return mesh.get(); }
};

class Scene {
 public:
  std::vector<SceneObject> objects;
  Camera camera;
  int active_object_index;

  Scene() : active_object_index(-1) {}

  int add_cube(float size = 2.0f)
  {
    SceneObject obj;
    obj.mesh = std::make_unique<EditMesh>(EditMesh::create_cube(size));
    obj.update_transform();
    objects.push_back(std::move(obj));
    active_object_index = (int)objects.size() - 1;
    return active_object_index;
  }

  int add_plane(float size = 2.0f)
  {
    SceneObject obj;
    obj.mesh = std::make_unique<EditMesh>(EditMesh::create_plane(size));
    obj.update_transform();
    objects.push_back(std::move(obj));
    active_object_index = (int)objects.size() - 1;
    return active_object_index;
  }

  SceneObject *get_object(int index)
  {
    if (index >= 0 && index < (int)objects.size()) {
      return &objects[index];
    }
    return nullptr;
  }

  SceneObject *get_active_object()
  {
    return get_object(active_object_index);
  }

  int object_count() const { return (int)objects.size(); }

  int duplicate_active_object()
  {
    SceneObject *src = get_active_object();
    if (!src || !src->mesh) {
      return -1;
    }

    SceneObject obj;
    obj.name = src->name + ".001";

    /* Deep copy the mesh */
    obj.mesh = std::make_unique<EditMesh>();
    obj.mesh->smooth_shading = src->mesh->smooth_shading;
    obj.mesh->vertices.reserve(src->mesh->vertices.size());
    for (const auto &v : src->mesh->vertices) {
      obj.mesh->vertices.push_back(v);
    }
    obj.mesh->faces.reserve(src->mesh->faces.size());
    for (const auto &f : src->mesh->faces) {
      obj.mesh->faces.push_back(f);
    }

    /* Copy transform */
    copy_v3_v3(obj.location, src->location);
    copy_qt_qt(obj.rotation, src->rotation);
    copy_v3_v3(obj.scale, src->scale);

    /* Offset on X */
    obj.location[0] += 2.0f;
    obj.update_transform();

    objects.push_back(std::move(obj));
    active_object_index = (int)objects.size() - 1;
    return active_object_index;
  }

  void remove_object(int index)
  {
    if (index < 0 || index >= (int)objects.size()) {
      return;
    }
    objects.erase(objects.begin() + index);
    if (objects.empty()) {
      active_object_index = -1;
    }
    else if (active_object_index >= (int)objects.size()) {
      active_object_index = (int)objects.size() - 1;
    }
  }

  Camera *get_camera() { return &camera; }
};
