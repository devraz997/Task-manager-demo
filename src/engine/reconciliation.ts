import { v4 as uuidv4 } from 'uuid';
import type { TimelineEvent, Task, TaskDelta, AppState } from '../types';
import { deriveTasks } from './derivation';

export type EngineAction = 
  | { type: 'CREATE', title: string, description?: string, parentId?: string }
  | { type: 'UPDATE', id: string, payload: TaskDelta }
  | { type: 'COMPLETE', id: string }
  | { type: 'REOPEN', id: string }
  | { type: 'DELETE', id: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export interface ReconciliationResult {
  nextLog: TimelineEvent[];
  nextCursor: number;
}

export function reconcileAction(state: AppState, action: EngineAction): AppState {
  const { eventLog, cursor } = state;
  const currentTasks = deriveTasks(eventLog, cursor);

  // Time Travel bounds caching
  if (action.type === 'UNDO') {
    if (cursor > 0) {
      return { eventLog, cursor: cursor - 1 };
    }
    return state; // Disable bounds check
  }

  if (action.type === 'REDO') {
    if (cursor < eventLog.length) {
      return { eventLog, cursor: cursor + 1 };
    }
    return state;
  }

  // Branch Truncation (IRREVERSIBLE as per NFR)
  let activeLog = eventLog;
  if (cursor < eventLog.length) {
    activeLog = eventLog.slice(0, cursor);
  }

  const eventsToAppend: TimelineEvent[] = [];
  const now = new Date().toISOString();

  switch (action.type) {
    case 'CREATE': {
      const taskId = uuidv4();
      const parentId = action.parentId || null;
      if (parentId) {
        const parent = currentTasks.get(parentId);
        if (!parent || parent.status === 'tombstoned' || parent.status === 'orphan_flagged') {
          throw new Error('Cannot create child: parent invalid or non-existent');
        }
      }
      const task: Task = {
        id: taskId,
        title: action.title,
        description: action.description || null,
        status: 'todo',
        parentId,
        createdAt: now,
      };

      eventsToAppend.push({
        id: uuidv4(),
        type: 'TASK_CREATED',
        timestamp: now,
        actionLabel: `Created '${task.title}'`,
        payload: task,
        intent: { reason: 'user_action', sourceEventId: null },
        causedBy: null,
        previousState: null
      });
      break;
    }

    case 'UPDATE': {
      const task = currentTasks.get(action.id);
      if (!task) throw new Error('Task not found');

      eventsToAppend.push({
        id: uuidv4(),
        type: 'TASK_UPDATED',
        timestamp: now,
        actionLabel: `Updated '${task.title}'`,
        payload: { id: task.id, ...action.payload },
        intent: { reason: 'user_action', sourceEventId: null },
        causedBy: null,
        previousState: { ...task }
      });
      break;
    }

    case 'COMPLETE': {
      const task = currentTasks.get(action.id);
      if (!task) throw new Error('Task not found');
      eventsToAppend.push({
        id: uuidv4(),
        type: 'TASK_COMPLETED',
        timestamp: now,
        actionLabel: `Completed '${task.title}'`,
        payload: { id: task.id, status: 'done' },
        intent: { reason: 'user_action', sourceEventId: null },
        causedBy: null,
        previousState: { ...task }
      });
      break;
    }

    case 'REOPEN': {
      const task = currentTasks.get(action.id);
      if (!task) throw new Error('Task not found');
      eventsToAppend.push({
        id: uuidv4(),
        type: 'TASK_REOPENED',
        timestamp: now,
        actionLabel: `Reopened '${task.title}'`,
        payload: { id: task.id, status: 'todo' },
        intent: { reason: 'user_action', sourceEventId: null },
        causedBy: null,
        previousState: { ...task }
      });
      break;
    }

    case 'DELETE': {
      const task = currentTasks.get(action.id);
      if (!task) throw new Error('Task not found');

      const rootEventId = uuidv4();
      eventsToAppend.push({
        id: rootEventId,
        type: 'TASK_DELETED',
        timestamp: now,
        actionLabel: `Deleted '${task.title}'`,
        payload: { id: task.id },
        intent: { reason: 'user_action', sourceEventId: null },
        causedBy: null,
        previousState: { ...task }
      });

      // Promote immediate children to root (DETACH)
      const children = Array.from(currentTasks.values()).filter(t => t.parentId === action.id);
      for (const child of children) {
        eventsToAppend.push({
          id: uuidv4(),
          type: 'TASK_DETACHED',
          timestamp: now,
          actionLabel: `Promoted '${child.title}' to root (parent deleted)`,
          payload: { id: child.id, parentId: null },
          intent: { reason: 'cascade_from_parent', sourceEventId: rootEventId },
          causedBy: rootEventId,
          previousState: { ...child }
        });
      }
      break;
    }
  }

  // Atomically commit all generated events
  return {
    eventLog: [...activeLog, ...eventsToAppend],
    cursor: activeLog.length + eventsToAppend.length, // move cursor to new head
  };
}

