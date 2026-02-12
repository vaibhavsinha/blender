# SPDX-License-Identifier: GPL-2.0-or-later
# Blender Web Lite — Standalone WASM build
#
# Usage:
#   mkdir build && cd build
#   emcmake cmake ..
#   emmake make -j$(nproc)

cmake_minimum_required(VERSION 3.18)
project(blender_web CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# Paths relative to this CMakeLists.txt
# ---------------------------------------------------------------------------

set(BLENDER_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../..)
set(BLI_DIR ${BLENDER_ROOT}/source/blender/blenlib)
set(BLI_INTERN ${BLI_DIR}/intern)
set(DNA_DIR ${BLENDER_ROOT}/source/blender/makesdna)
set(GUARDEDALLOC_DIR ${BLENDER_ROOT}/intern/guardedalloc)
set(EIGEN_DIR ${BLENDER_ROOT}/intern/eigen)
set(ATOMIC_DIR ${BLENDER_ROOT}/intern/atomic)
set(XXHASH_DIR ${BLENDER_ROOT}/extern/xxhash)
set(WCWIDTH_DIR ${BLENDER_ROOT}/extern/wcwidth)
set(JSON_DIR ${BLENDER_ROOT}/extern/json/include)

# ---------------------------------------------------------------------------
# Fetch fmtlib (header-only for our purposes)
# ---------------------------------------------------------------------------

include(FetchContent)
FetchContent_Declare(
  fmt
  GIT_REPOSITORY https://github.com/fmtlib/fmt.git
  GIT_TAG        9.1.0
  GIT_SHALLOW    TRUE
)
# Header-only mode + disable consteval (Emscripten clang bug with consteval).
# FMT_CONSTEVAL must be defined empty so the #ifndef guard is hit.
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -DFMT_HEADER_ONLY=1 -DFMT_CONSTEVAL=")
FetchContent_Populate(fmt)
set(FMT_INCLUDE_DIR ${fmt_SOURCE_DIR}/include)

# ---------------------------------------------------------------------------
# Fetch Eigen (header-only)
# ---------------------------------------------------------------------------

FetchContent_Declare(
  eigen
  GIT_REPOSITORY https://gitlab.com/libeigen/eigen.git
  GIT_TAG        3.4.0
  GIT_SHALLOW    TRUE
)
FetchContent_Populate(eigen)

# ---------------------------------------------------------------------------
# BLI source files — math, containers, utilities
# We exclude: file I/O, threads, tasks, subprocess, mmap, system,
#             compression, fftw, csv, delaunay (GMP), mesh_boolean (GMP),
#             winstuff, storage, serialize, smaa_textures, memory_cache_file_load,
#             expr_pylike_eval, dot_export, BLI_args, tempfile,
#             BLI_filelist, path_utils, fnmatch
# ---------------------------------------------------------------------------

set(BLI_SOURCES
  # Math
  ${BLI_INTERN}/math_base.cc
  ${BLI_INTERN}/math_basis_types.cc
  ${BLI_INTERN}/math_boolean.cc
  ${BLI_INTERN}/math_color.cc
  ${BLI_INTERN}/math_filter.cc
  ${BLI_INTERN}/math_geom.cc
  ${BLI_INTERN}/math_half.cc
  ${BLI_INTERN}/math_interp.cc
  ${BLI_INTERN}/math_matrix.cc
  ${BLI_INTERN}/math_matrix_c.cc
  ${BLI_INTERN}/math_rotation.cc
  ${BLI_INTERN}/math_rotation_c.cc
  ${BLI_INTERN}/math_solvers.cc
  ${BLI_INTERN}/math_statistics.cc
  ${BLI_INTERN}/math_time.cc
  ${BLI_INTERN}/math_vec.cc
  ${BLI_INTERN}/math_vector.cc
  ${BLI_INTERN}/noise.cc
  ${BLI_INTERN}/easing.cc

  # Memory & containers
  ${BLI_INTERN}/BLI_assert.cc
  ${BLI_INTERN}/BLI_color.cc
  ${BLI_INTERN}/BLI_colorspace.cc
  ${BLI_INTERN}/BLI_dial_2d.cc
  ${BLI_INTERN}/BLI_dynstr.cc
  ${BLI_INTERN}/BLI_ghash.cc
  ${BLI_INTERN}/BLI_ghash_utils.cc
  ${BLI_INTERN}/BLI_heap.cc
  ${BLI_INTERN}/BLI_heap_simple.cc
  ${BLI_INTERN}/BLI_kdopbvh.cc
  ${BLI_INTERN}/BLI_linklist.cc
  ${BLI_INTERN}/BLI_linklist_lockfree.cc
  ${BLI_INTERN}/BLI_memarena.cc
  ${BLI_INTERN}/BLI_memblock.cc
  ${BLI_INTERN}/BLI_memiter.cc
  ${BLI_INTERN}/BLI_mempool.cc
  ${BLI_INTERN}/BLI_timer.cc

  # String
  ${BLI_INTERN}/string.cc
  ${BLI_INTERN}/string_ref.cc
  ${BLI_INTERN}/string_cursor_utf8.cc
  ${BLI_INTERN}/string_search.cc
  ${BLI_INTERN}/string_utf8.cc
  ${BLI_INTERN}/string_utils.cc

  # Data structures
  ${BLI_INTERN}/array_store.cc
  ${BLI_INTERN}/array_store_rle.cc
  ${BLI_INTERN}/array_store_utils.cc
  ${BLI_INTERN}/array_utils.cc
  ${BLI_INTERN}/array_utils_c.cc
  ${BLI_INTERN}/astar.cc
  ${BLI_INTERN}/atomic_disjoint_set.cc
  ${BLI_INTERN}/bit_bool_conversion.cc
  ${BLI_INTERN}/bit_ref.cc
  ${BLI_INTERN}/bit_span.cc
  ${BLI_INTERN}/bitmap.cc
  ${BLI_INTERN}/bitmap_draw_2d.cc
  ${BLI_INTERN}/boxpack_2d.cc
  ${BLI_INTERN}/compute_context.cc
  ${BLI_INTERN}/convexhull_2d.cc
  ${BLI_INTERN}/cpp_type.cc
  ${BLI_INTERN}/cpp_types.cc
  ${BLI_INTERN}/endian_switch.cc
  ${BLI_INTERN}/generic_vector_array.cc
  ${BLI_INTERN}/generic_virtual_array.cc
  ${BLI_INTERN}/generic_virtual_vector_array.cc
  ${BLI_INTERN}/gsqueue.cc
  ${BLI_INTERN}/hash_md5.cc
  ${BLI_INTERN}/hash_mm2a.cc
  ${BLI_INTERN}/hash_mm3.cc
  ${BLI_INTERN}/hash_tables.cc
  ${BLI_INTERN}/implicit_sharing.cc
  ${BLI_INTERN}/index_mask.cc
  ${BLI_INTERN}/index_mask_expression.cc
  ${BLI_INTERN}/index_range.cc
  ${BLI_INTERN}/jitter_2d.cc
  ${BLI_INTERN}/lasso_2d.cc
  ${BLI_INTERN}/length_parameterize.cc
  ${BLI_INTERN}/listbase.cc
  ${BLI_INTERN}/memory_cache.cc
  ${BLI_INTERN}/memory_counter.cc
  ${BLI_INTERN}/memory_utils.cc
  ${BLI_INTERN}/offset_indices.cc
  ${BLI_INTERN}/ordered_edge.cc
  ${BLI_INTERN}/polyfill_2d.cc
  ${BLI_INTERN}/polyfill_2d_beautify.cc
  ${BLI_INTERN}/quadric.cc
  ${BLI_INTERN}/radial_tiling_wrapper.cc
  ${BLI_INTERN}/rand.cc
  ${BLI_INTERN}/rct.cc
  ${BLI_INTERN}/resource_scope.cc
  ${BLI_INTERN}/scanfill.cc
  ${BLI_INTERN}/scanfill_utils.cc
  ${BLI_INTERN}/session_uid.cc
  ${BLI_INTERN}/sort.cc
  ${BLI_INTERN}/sort_utils.cc
  ${BLI_INTERN}/stack.cc
  ${BLI_INTERN}/time.cc
  ${BLI_INTERN}/timecode.cc
  ${BLI_INTERN}/timeit.cc
  ${BLI_INTERN}/uuid.cc
  ${BLI_INTERN}/vector.cc
  ${BLI_INTERN}/virtual_array.cc
  ${BLI_INTERN}/voxel.cc
)

# ---------------------------------------------------------------------------
# guardedalloc sources
# ---------------------------------------------------------------------------

set(GUARDEDALLOC_SOURCES
  ${GUARDEDALLOC_DIR}/intern/leak_detector.cc
  ${GUARDEDALLOC_DIR}/intern/mallocn.cc
  ${GUARDEDALLOC_DIR}/intern/mallocn_guarded_impl.cc
  ${GUARDEDALLOC_DIR}/intern/mallocn_lockfree_impl.cc
  ${GUARDEDALLOC_DIR}/intern/memory_usage.cc
)

# ---------------------------------------------------------------------------
# Eigen wrapper sources
# ---------------------------------------------------------------------------

set(EIGEN_SOURCES
  ${EIGEN_DIR}/intern/eigenvalues.cc
  ${EIGEN_DIR}/intern/linear_solver.cc
  ${EIGEN_DIR}/intern/matrix.cc
  ${EIGEN_DIR}/intern/svd.cc
)

# ---------------------------------------------------------------------------
# xxhash (single-file library)
# ---------------------------------------------------------------------------

set(XXHASH_SOURCES
  ${XXHASH_DIR}/xxhash.c
)

# ---------------------------------------------------------------------------
# wcwidth (single-file library)
# ---------------------------------------------------------------------------

set(WCWIDTH_SOURCES
  ${WCWIDTH_DIR}/wcwidth.c
)

# ---------------------------------------------------------------------------
# Our stubs for WASM
# ---------------------------------------------------------------------------

set(STUB_SOURCES
  stubs/system_stubs.cc
  stubs/mmap_stubs.cc
  stubs/threads_stubs.cc
  stubs/task_stubs.cc
  stubs/misc_stubs.cc
)

# ---------------------------------------------------------------------------
# Custom sources (mesh, scene, bindings)
# ---------------------------------------------------------------------------

set(CUSTOM_SOURCES
  src/mesh.cc
  src/bindings.cc
)

# ---------------------------------------------------------------------------
# All sources combined
# ---------------------------------------------------------------------------

add_executable(blender_web
  ${BLI_SOURCES}
  ${GUARDEDALLOC_SOURCES}
  ${EIGEN_SOURCES}
  ${XXHASH_SOURCES}
  ${WCWIDTH_SOURCES}
  ${STUB_SOURCES}
  ${CUSTOM_SOURCES}
)

# ---------------------------------------------------------------------------
# Include directories
# ---------------------------------------------------------------------------

target_include_directories(blender_web PRIVATE
  # BLI headers
  ${BLI_DIR}
  # DNA headers (for DNA_vec_types.h, DNA_listBase.h, etc.)
  ${DNA_DIR}
  # guardedalloc
  ${GUARDEDALLOC_DIR}
  # Eigen wrappers
  ${EIGEN_DIR}
  # Eigen header-only library (fetched)
  ${eigen_SOURCE_DIR}
  # Atomic ops
  ${ATOMIC_DIR}
  # xxhash
  ${XXHASH_DIR}
  # wcwidth
  ${WCWIDTH_DIR}
  # json
  ${JSON_DIR}
  # Our custom code
  ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# ---------------------------------------------------------------------------
# Compile definitions
# ---------------------------------------------------------------------------

target_compile_definitions(blender_web PRIVATE
  WITH_ASSERT_ABORT=0
)

# Suppress warnings from Blender code that aren't errors in the native build.
target_compile_options(blender_web PRIVATE
  -Wno-sign-conversion
  -Wno-c++11-narrowing
  -Wno-implicit-int-float-conversion
  -Wno-deprecated-declarations
  -Wno-shorten-64-to-32
  -Wno-unused-but-set-variable
  -Wno-ambiguous-reversed-operator
)

# Some BLI files use #pragma GCC diagnostic error which overrides command-line
# flags in clang. Use -w to suppress ALL warnings for these specific files.
set_source_files_properties(
  ${BLI_INTERN}/string_utf8.cc
  ${BLI_INTERN}/math_geom.cc
  ${BLI_INTERN}/math_color.cc
  ${BLI_INTERN}/convexhull_2d.cc
  ${BLI_INTERN}/polyfill_2d.cc
  ${BLI_INTERN}/polyfill_2d_beautify.cc
  ${BLI_INTERN}/scanfill.cc
  ${BLI_INTERN}/scanfill_utils.cc
  PROPERTIES COMPILE_FLAGS "-w"
)

# ---------------------------------------------------------------------------
# fmtlib include (header-only mode)
# ---------------------------------------------------------------------------

target_include_directories(blender_web PRIVATE ${FMT_INCLUDE_DIR})

# ---------------------------------------------------------------------------
# Emscripten-specific flags
# ---------------------------------------------------------------------------

if(EMSCRIPTEN)
  set_target_properties(blender_web PROPERTIES
    SUFFIX ".js"
  )

  target_link_options(blender_web PRIVATE
    -lembind
    -sWASM=1
    -sMODULARIZE=1
    -sEXPORT_NAME=createBlenderWeb
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=67108864
    -sSTACK_SIZE=1048576
    -sNO_EXIT_RUNTIME=1
    -sENVIRONMENT=web
  )

  # Optimization for release
  if(CMAKE_BUILD_TYPE STREQUAL "Release")
    target_compile_options(blender_web PRIVATE -O2 -flto)
    target_link_options(blender_web PRIVATE -O2 -flto)
  else()
    target_compile_options(blender_web PRIVATE -O1 -g)
    target_link_options(blender_web PRIVATE -O1 -g)
  endif()
endif()
