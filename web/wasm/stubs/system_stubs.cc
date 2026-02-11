/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — WASM stubs for system.cc
 * Replaces: source/blender/blenlib/intern/system.cc */

#include <climits>
#include <cstdio>
#include <cstring>

#include "BLI_string.h"
#include "BLI_system.h"

namespace blender {

int BLI_cpu_support_sse2()
{
  return 0;
}

int BLI_cpu_support_sse42()
{
  return 0;
}

char *BLI_cpu_brand_string()
{
  return nullptr;
}

void BLI_hostname_get(char *buffer, size_t buffer_maxncpy)
{
  BLI_strncpy(buffer, "wasm-browser", buffer_maxncpy);
}

void BLI_system_backtrace(FILE * /*fp*/) {}

void BLI_system_backtrace_with_os_info(FILE * /*fp*/, const void * /*os_info*/) {}

size_t BLI_system_memory_max_in_megabytes()
{
  return 2048; /* 2 GB — typical browser limit */
}

int BLI_system_memory_max_in_megabytes_int()
{
  return 2048;
}

}  // namespace blender
