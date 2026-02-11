/* SPDX-License-Identifier: GPL-2.0-or-later
 * Blender Web Lite — WASM stubs for task_*.cc
 * Replaces: task_pool.cc, task_scheduler.cc, task_range.cc, task_iterator.cc, task_graph.cc
 * All tasks execute synchronously on the main thread. */

#include <cstdlib>
#include <cstring>
#include <vector>

#include "BLI_task.h"

#include "MEM_guardedalloc.h"

namespace blender {

/* -------------------------------------------------------------------- */
/** \name Task Scheduler (single-threaded)
 * \{ */

static int task_scheduler_num_threads = 1;

void BLI_task_scheduler_init()
{
  task_scheduler_num_threads = 1;
}

void BLI_task_scheduler_exit() {}

int BLI_task_scheduler_num_threads()
{
  return task_scheduler_num_threads;
}

void BLI_task_isolate(void (*func)(void *userdata), void *userdata)
{
  func(userdata);
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Task Pool (synchronous)
 * \{ */

struct TaskPool {
  void *userdata;
  bool canceled;
};

TaskPool *BLI_task_pool_create(void *userdata, eTaskPriority /*priority*/)
{
  TaskPool *pool = (TaskPool *)MEM_callocN(sizeof(TaskPool), "TaskPool");
  pool->userdata = userdata;
  pool->canceled = false;
  return pool;
}

TaskPool *BLI_task_pool_create_background(void *userdata, eTaskPriority priority)
{
  return BLI_task_pool_create(userdata, priority);
}

TaskPool *BLI_task_pool_create_background_serial(void *userdata, eTaskPriority priority)
{
  return BLI_task_pool_create(userdata, priority);
}

TaskPool *BLI_task_pool_create_suspended(void *userdata, eTaskPriority priority)
{
  return BLI_task_pool_create(userdata, priority);
}

TaskPool *BLI_task_pool_create_no_threads(void *userdata)
{
  return BLI_task_pool_create(userdata, TASK_PRIORITY_LOW);
}

void BLI_task_pool_free(TaskPool *pool)
{
  MEM_freeN(pool);
}

void BLI_task_pool_push(TaskPool *pool,
                        TaskRunFunction run,
                        void *taskdata,
                        bool free_taskdata,
                        TaskFreeFunction freedata)
{
  /* Execute immediately (synchronous) */
  if (!pool->canceled) {
    run(pool, taskdata);
  }
  if (free_taskdata && freedata) {
    freedata(pool, taskdata);
  }
}

void BLI_task_pool_work_and_wait(TaskPool * /*pool*/)
{
  /* All work already done in push */
}

void BLI_task_pool_cancel(TaskPool *pool)
{
  pool->canceled = true;
}

bool BLI_task_pool_current_canceled(TaskPool *pool)
{
  return pool->canceled;
}

void *BLI_task_pool_user_data(TaskPool *pool)
{
  return pool->userdata;
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Parallel Range (sequential fallback)
 * \{ */

void BLI_task_parallel_range(int start,
                             int stop,
                             void *userdata,
                             TaskParallelRangeFunc func,
                             const TaskParallelSettings *settings)
{
  TaskParallelTLS tls;
  void *userdata_chunk = nullptr;

  if (settings && settings->userdata_chunk_size > 0 && settings->userdata_chunk) {
    userdata_chunk = MEM_mallocN(settings->userdata_chunk_size, "task_chunk");
    if (settings->func_init) {
      settings->func_init(userdata, userdata_chunk);
    }
    else {
      memcpy(userdata_chunk, settings->userdata_chunk, settings->userdata_chunk_size);
    }
  }

  tls.userdata_chunk = userdata_chunk;

  for (int i = start; i < stop; i++) {
    func(userdata, i, &tls);
  }

  if (userdata_chunk) {
    if (settings->func_reduce) {
      settings->func_reduce(userdata, settings->userdata_chunk, userdata_chunk);
    }
    if (settings->func_free) {
      settings->func_free(userdata, userdata_chunk);
    }
    else {
      MEM_freeN(userdata_chunk);
    }
  }
}

void BLI_task_parallel_mempool(struct BLI_mempool * /*mempool*/,
                               void * /*userdata*/,
                               TaskParallelMempoolFunc /*func*/,
                               const TaskParallelSettings * /*settings*/)
{
  /* Not needed for our use case; no-op. */
}

int BLI_task_parallel_thread_id(const TaskParallelTLS * /*tls*/)
{
  return 0;
}

/** \} */

/* -------------------------------------------------------------------- */
/** \name Task Graph (sequential)
 * \{ */

struct TaskNode {
  TaskGraphNodeRunFunction run;
  void *user_data;
  TaskGraphNodeFreeFunction free_func;
  std::vector<TaskNode *> children;
};

struct TaskGraph {
  std::vector<TaskNode *> nodes;
};

TaskGraph *BLI_task_graph_create()
{
  return MEM_new<TaskGraph>(__func__);
}

void BLI_task_graph_work_and_wait(TaskGraph * /*task_graph*/)
{
  /* All work done immediately in push_work */
}

void BLI_task_graph_free(TaskGraph *task_graph)
{
  for (TaskNode *node : task_graph->nodes) {
    if (node->free_func && node->user_data) {
      node->free_func(node->user_data);
    }
    MEM_delete(node);
  }
  MEM_delete(task_graph);
}

TaskNode *BLI_task_graph_node_create(TaskGraph *task_graph,
                                     TaskGraphNodeRunFunction run,
                                     void *user_data,
                                     TaskGraphNodeFreeFunction free_func)
{
  TaskNode *node = MEM_new<TaskNode>(__func__);
  node->run = run;
  node->user_data = user_data;
  node->free_func = free_func;
  task_graph->nodes.push_back(node);
  return node;
}

static void task_graph_node_run_recursive(TaskNode *node)
{
  if (node->run) {
    node->run(node->user_data);
  }
  for (TaskNode *child : node->children) {
    task_graph_node_run_recursive(child);
  }
}

bool BLI_task_graph_node_push_work(TaskNode *task_node)
{
  task_graph_node_run_recursive(task_node);
  return true;
}

void BLI_task_graph_edge_create(TaskNode *from_node, TaskNode *to_node)
{
  from_node->children.push_back(to_node);
}

/** \} */

}  // namespace blender
