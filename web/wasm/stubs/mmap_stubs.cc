/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — WASM stubs for BLI_mmap.cc
 * Replaces: source/blender/blenlib/intern/BLI_mmap.cc */

#include "BLI_mmap.h"
#include "MEM_guardedalloc.h"

namespace blender {

BLI_mmap_file *BLI_mmap_open(int /*fd*/)
{
  return nullptr;
}

void *BLI_mmap_get_pointer(BLI_mmap_file * /*file*/)
{
  return nullptr;
}

size_t BLI_mmap_get_length(const BLI_mmap_file * /*file*/)
{
  return 0;
}

bool BLI_mmap_read(BLI_mmap_file * /*file*/,
                   void * /*dest*/,
                   size_t /*offset*/,
                   size_t /*length*/)
{
  return false;
}

bool BLI_mmap_any_io_error(const BLI_mmap_file * /*file*/)
{
  return true;
}

void BLI_mmap_free(BLI_mmap_file * /*file*/) {}

}  // namespace blender
