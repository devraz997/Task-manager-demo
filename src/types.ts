export type TaskStatus = "todo" | "in-progress" | "done" | "tombstoned" | "orphan_flagged";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  parentId: string | null;
  createdAt: string;
}

export type TaskDelta = Partial<Task>;

export type EventType = 
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_COMPLETED"
  | "TASK_REOPENED"
  | "TASK_DELETED"
  | "TASK_TOMBSTONED"
  | "TASK_RESURRECTED"
  | "TASK_DETACHED"
  | "TASK_ORPHAN_FLAGGED";

export type IntentReason = 
  | "user_action" 
  | "cascade_from_parent" 
  | "reconciliation" 
  | "resurrection";

export interface Intent {
  reason: IntentReason;
  sourceEventId: string | null; // e.g. the id of the user_action event that started this cascade
}

export interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string; // ISO string
  actionLabel: string;
  payload: TaskDelta;
  intent: Intent;
  causedBy: string | null; // direct parent event in causal chain
  previousState: Partial<Task> | null;
}

export interface AppState {
  eventLog: TimelineEvent[];
  cursor: number;
}
