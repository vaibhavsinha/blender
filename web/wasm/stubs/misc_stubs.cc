/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — WASM stubs for misc BLI files
 * Replaces: cache_mutex.cc, lazy_threading.cc, timecode.cc, timeit.cc */

#include "BLI_cache_mutex.hh"
#include "BLI_lazy_threading.hh"

namespace blender {

/* -------------------------------------------------------------------- */
/** \name Cache Mutex (execute immediately, no locking)
 * \{ */

void CacheMutex::ensure_impl(const FunctionRef<void()> compute_cache)
{
  compute_cache();
  cache_valid_ = true;
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Lazy Threading (no-ops for single-threaded WASM)
 * \{ */

namespace lazy_threading {

void send_hint() {}

HintReceiver::HintReceiver(const FunctionRef<void()> /*fn*/) {}
HintReceiver::~HintReceiver() {}

ReceiverIsolation::ReceiverIsolation() {}
ReceiverIsolation::~ReceiverIsolation() {}

}  // namespace lazy_threading

/** \} */

}  // namespace blender
