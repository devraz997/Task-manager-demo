import type { TimelineEvent, Task } from '../types';

export function deriveTasks(eventLog: TimelineEvent[], cursor: number): Map<string, Task> {
  const tasks = new Map<string, Task>();
  const activeEvents = eventLog.slice(0, cursor);

  for (const event of activeEvents) {
    const payloadId = event.payload.id ?? (event.previousState?.id);
    if (!payloadId) continue;

    switch (event.type) {
      case 'TASK_CREATED':
      case 'TASK_RESURRECTED':
        // We use payload for new tasks and resurrections
        tasks.set(payloadId, { ...event.payload } as Task);
        break;

      case 'TASK_UPDATED':
      case 'TASK_COMPLETED':
      case 'TASK_REOPENED':
      case 'TASK_TOMBSTONED':
      case 'TASK_ORPHAN_FLAGGED':
        if (tasks.has(payloadId)) {
          tasks.set(payloadId, { ...tasks.get(payloadId)!, ...event.payload });
        }
        break;

      case 'TASK_DELETED':
        // A direct TASK_DELETED completely removes the task from derived state
        tasks.delete(payloadId);
        break;
      
      case 'TASK_DETACHED':
        if (tasks.has(payloadId)) {
          tasks.set(payloadId, { ...tasks.get(payloadId)!, parentId: null });
        }
        break;
    }
  }

  return tasks;
}
