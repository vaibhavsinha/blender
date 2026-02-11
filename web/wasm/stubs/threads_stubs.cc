/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — WASM stubs for threads.cc
 * Replaces: source/blender/blenlib/intern/threads.cc
 * Single-threaded stubs for browser environment. */

#include <cstdlib>
#include <cstring>

#include "BLI_threads.h"

#include "MEM_guardedalloc.h"

namespace blender {

static int threads_override_num = 0;

void BLI_threadapi_init() {}
void BLI_threadapi_exit() {}

void BLI_threadpool_init(ListBaseT<ThreadSlot> * /*threadbase*/,
                         void *(*/*do_thread*/)(void *),
                         int /*tot*/)
{
}
void BLI_threadpool_insert(ListBaseT<ThreadSlot> * /*threadbase*/, void * /*callerdata*/) {}
void BLI_threadpool_remove(ListBaseT<ThreadSlot> * /*threadbase*/, void * /*callerdata*/) {}
void BLI_threadpool_remove_index(ListBaseT<ThreadSlot> * /*threadbase*/, int /*index*/) {}
void BLI_threadpool_clear(ListBaseT<ThreadSlot> * /*threadbase*/) {}
void BLI_threadpool_end(ListBaseT<ThreadSlot> * /*threadbase*/) {}

int BLI_available_threads(ListBaseT<ThreadSlot> * /*threadbase*/)
{
  return 1;
}

int BLI_threadpool_available_thread_index(ListBaseT<ThreadSlot> * /*threadbase*/)
{
  return 0;
}

int BLI_thread_is_main()
{
  return 1;
}

int BLI_system_thread_count()
{
  return 1;
}

void BLI_system_num_threads_override_set(int num)
{
  threads_override_num = num;
}

int BLI_system_num_threads_override_get()
{
  return threads_override_num;
}

/* Mutex — no-ops for single-threaded WASM */
void BLI_mutex_init(ThreadMutex * /*mutex*/) {}
void BLI_mutex_lock(ThreadMutex * /*mutex*/) {}
void BLI_mutex_unlock(ThreadMutex * /*mutex*/) {}

bool BLI_mutex_trylock(ThreadMutex * /*mutex*/)
{
  return true;
}

void BLI_mutex_end(ThreadMutex * /*mutex*/) {}

ThreadMutex *BLI_mutex_alloc()
{
  ThreadMutex *mutex = (ThreadMutex *)MEM_callocN(sizeof(ThreadMutex), "ThreadMutex");
  return mutex;
}

void BLI_mutex_free(ThreadMutex *mutex)
{
  MEM_freeN(mutex);
}

/* Spin locks — no-ops */
void BLI_spin_init(SpinLock * /*spin*/) {}
void BLI_spin_lock(SpinLock * /*spin*/) {}
void BLI_spin_unlock(SpinLock * /*spin*/) {}
void BLI_spin_end(SpinLock * /*spin*/) {}

/* RW mutex — no-ops */
void BLI_rw_mutex_init(ThreadRWMutex * /*mutex*/) {}

void BLI_rw_mutex_lock(ThreadRWMutex * /*mutex*/, int /*mode*/) {}
void BLI_rw_mutex_unlock(ThreadRWMutex * /*mutex*/) {}
void BLI_rw_mutex_end(ThreadRWMutex * /*mutex*/) {}

ThreadRWMutex *BLI_rw_mutex_alloc()
{
  ThreadRWMutex *mutex = (ThreadRWMutex *)MEM_callocN(sizeof(ThreadRWMutex), "ThreadRWMutex");
  return mutex;
}

void BLI_rw_mutex_free(ThreadRWMutex *mutex)
{
  MEM_freeN(mutex);
}

/* Ticket mutex */
TicketMutex *BLI_ticket_mutex_alloc()
{
  return (TicketMutex *)MEM_callocN(sizeof(TicketMutex), "TicketMutex");
}

void BLI_ticket_mutex_free(TicketMutex *ticket)
{
  MEM_freeN(ticket);
}

void BLI_ticket_mutex_lock(TicketMutex * /*ticket*/) {}

bool BLI_ticket_mutex_lock_check_recursive(TicketMutex * /*ticket*/)
{
  return false;
}

void BLI_ticket_mutex_unlock(TicketMutex * /*ticket*/) {}

/* Condition variables — no-ops */
void BLI_condition_init(ThreadCondition * /*cond*/) {}
void BLI_condition_wait(ThreadCondition * /*cond*/, ThreadMutex * /*mutex*/) {}
void BLI_condition_wait_global_mutex(ThreadCondition * /*cond*/, int /*type*/) {}
void BLI_condition_notify_one(ThreadCondition * /*cond*/) {}
void BLI_condition_notify_all(ThreadCondition * /*cond*/) {}
void BLI_condition_end(ThreadCondition * /*cond*/) {}

/* Global locks — no-ops */
void BLI_thread_lock(int /*type*/) {}
void BLI_thread_unlock(int /*type*/) {}

/* Thread queue — synchronous stubs */
ThreadQueue *BLI_thread_queue_init()
{
  return (ThreadQueue *)MEM_callocN(sizeof(ThreadQueue), "ThreadQueue");
}

void BLI_thread_queue_free(ThreadQueue *queue)
{
  MEM_freeN(queue);
}

uint64_t BLI_thread_queue_push(ThreadQueue * /*queue*/,
                               void * /*work*/,
                               ThreadQueueWorkPriority /*priority*/)
{
  return 0;
}

bool BLI_thread_queue_cancel_work(ThreadQueue * /*queue*/, uint64_t /*work_id*/)
{
  return false;
}

void *BLI_thread_queue_pop(ThreadQueue * /*queue*/)
{
  return nullptr;
}

void *BLI_thread_queue_pop_timeout(ThreadQueue * /*queue*/, int /*ms*/)
{
  return nullptr;
}

int BLI_thread_queue_len(ThreadQueue * /*queue*/)
{
  return 0;
}

bool BLI_thread_queue_is_empty(ThreadQueue * /*queue*/)
{
  return true;
}

void BLI_thread_queue_nowait(ThreadQueue * /*queue*/) {}

void BLI_thread_queue_wait_finish(ThreadQueue * /*queue*/) {}

}  // namespace blender
