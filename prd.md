# Product Requirements Document
## Collaborative Task Manager with Time-Travel State

**Version:** 1.0
**Status:** Draft
**Architect:** Senior Software Architect

---

# 1. Product Overview

## 1.1 Purpose

A single-user collaborative task manager that supports hierarchical task relationships and full time-travel history navigation. The system's defining characteristic is its **intent-aware event log** — every state change records not just what changed, but why, enabling mathematically correct undo/redo across complex parent-child task graphs.

## 1.2 Problem Statement

Standard undo/redo systems operate on flat state. This product manages a **directed task graph** where parent-child relationships create cascading side effects. When a parent task is deleted or undone, naive state restoration silently corrupts child task states. This product solves that by treating the event log as the single source of truth and running an explicit reconciliation engine on every mutation.

## 1.3 Design Philosophy

- **Event log is the only source of truth.** Current state is always a derived projection, never stored directly.
- **Every event carries intent.** The system always knows whether a change was user-initiated or cascade-triggered.
- **Reconciliation is explicit.** A dedicated engine runs before every commit, resolving all side effects before they hit the log.
- **Undo/redo is symmetric.** Whatever undo does, redo must precisely mirror — including child resurrection to exact prior states.

---

# 2. Scope

## 2.1 In Scope — v1

- Task CRUD (create, update, complete, delete)
- Parent-child task hierarchy (multi-level)
- Intent-aware event log
- Reconciliation engine covering all parent/child mutation scenarios
- Undo/redo via controls and time-travel slider
- History log panel showing only user-initiated events
- Debug/inspector panel showing full event log including cascades
- Orphan detection and surface as UI warning

## 2.2 Out of Scope — v1

- Multi-user real-time collaboration
- Backend persistence (in-memory only)
- Authentication or user roles
- Task assignment, due dates, priorities
- Notifications or reminders
- Drag-and-drop reordering
- Export or import

---

# 3. User Stories

## 3.1 Task Management

> **US-01** — As a user, I want to create a task with a title and optional description so I can track a unit of work.

> **US-02** — As a user, I want to create a child task under an existing parent so I can break work into sub-tasks.

> **US-03** — As a user, I want to update a task's title, description, or status so I can reflect current reality.

> **US-04** — As a user, I want to mark a task as complete independently of its siblings and parent so I retain granular control.

> **US-05** — As a user, I want to delete a task and understand what happens to its children before I confirm.

## 3.2 Time Travel

> **US-06** — As a user, I want to undo my last action so I can recover from mistakes.

> **US-07** — As a user, I want to redo an undone action so I can reapply work I reversed accidentally.

> **US-08** — As a user, I want to drag a timeline slider to any past state so I can review or restore history non-linearly.

> **US-09** — As a user, I want each history entry to show a plain-language label so I understand what changed at each point.

## 3.3 Dependency Handling

> **US-10** — As a user, when I undo a parent task deletion, I want all children restored to their exact prior states so no work is silently lost.

> **US-11** — As a user, when I try to restore a child whose parent no longer exists, I want an explicit warning so I understand why the action is blocked.

> **US-12** — As a user, I want to see which events were user-initiated vs. system-cascaded so I understand the full history of a task.

---

# 4. Functional Requirements

---

## 4.1 Task Management

### FR-01 — Task Creation
- User provides: `title` (required), `description` (optional), `parentId` (optional)
- System assigns: `id` (uuid), `createdAt`, `status: "todo"`
- If `parentId` provided, system validates parent exists and is not tombstoned
- Emits: `TASK_CREATED` with `intent: user_action`

### FR-02 — Task Update
- User may update: `title`, `description`, `status`
- Status values: `todo` | `in-progress` | `done`
- Changing a parent's status does **not** auto-cascade to children (children are status-independent)
- Emits: `TASK_UPDATED` with `intent: user_action`, `previousState` capturing fields before change

### FR-03 — Task Completion
- Toggle between `done` and `todo`
- Parent completion is independent of child completion states
- Emits: `TASK_COMPLETED` or `TASK_REOPENED` with `intent: user_action`

### FR-04 — Task Deletion
- User initiates delete on a task
- If task has active children: system shows confirmation dialog listing affected children
- On confirm: reconciliation engine fires cascade tombstone events for all descendants (depth-first)
- Emits: `TASK_DELETED` + N × `TASK_TOMBSTONED` events (one per descendant)
- Tombstone event stores `previousState` of each child at moment of tombstoning

### FR-05 — Task Listing
- Active task tree: all tasks where `status != tombstoned` and `status != orphan_flagged`
- Rendered as indented hierarchy
- Collapsed by default beyond depth 2

---

## 4.2 Event Log & Intent System

### FR-06 — Event Schema

Every event committed to the log must conform to:

```
Event {
  id:            uuid
  type:          EventType
  timestamp:     datetime
  actionLabel:   string              // human-readable, shown in history UI
  payload:       TaskDelta           // fields that changed
  intent: {
    reason:      "user_action"
                 | "cascade_from_parent"
                 | "reconciliation"
                 | "resurrection"
    sourceEventId: uuid | null       // which user event caused this
  }
  causedBy:      uuid | null         // direct parent event in causal chain
  previousState: Partial<Task> | null // state before this event fired
}
```

### FR-07 — Event Types

```
TASK_CREATED          user creates a task
TASK_UPDATED          user edits title, description, or status
TASK_COMPLETED        user marks task done
TASK_REOPENED         user marks task todo after done
TASK_DELETED          user deletes a task
TASK_TOMBSTONED       system cascades delete to a child
TASK_RESURRECTED      system restores a child on parent undo
TASK_DETACHED         child promoted to root (future strategy, reserved)
TASK_ORPHAN_FLAGGED   child's parent is missing; restoration blocked
```

### FR-08 — Causal Chain Integrity
- Every cascade event (`TASK_TOMBSTONED`, `TASK_RESURRECTED`) must reference `causedBy: <user_event_id>`
- The reconciliation engine must reject any event that breaks causal chain integrity
- No event may be committed without a valid `intent.reason`

---

## 4.3 Reconciliation Engine

The reconciliation engine is a **pure function** invoked between user action intake and event log commit. It receives the proposed user event and returns the full set of events to commit atomically.

### FR-09 — Parent Deletion Cascade

```
TRIGGER: TASK_DELETED where task.children.length > 0

ENGINE:
  traverse(task) depth-first:
    for each child:
      capture child.currentState as previousState
      emit TASK_TOMBSTONED {
        intent: cascade_from_parent,
        causedBy: TASK_DELETED.id,
        previousState: child.currentState
      }
      recurse into child's children

INVARIANT: After commit, no active task may have parentId 
           pointing to a tombstoned or deleted task
```

### FR-10 — Undo Parent Deletion → Child Resurrection

```
TRIGGER: UNDO where target event type == TASK_DELETED

ENGINE:
  find all TASK_TOMBSTONED events where causedBy == target_event.id
  for each:
    verify parent chain is fully alive (walk ancestry)
    if parent chain alive:
      emit TASK_RESURRECTED {
        restoreState: tombstone_event.previousState,
        intent: resurrection,
        causedBy: undo_event.id
      }
    else:
      emit TASK_ORPHAN_FLAGGED {
        intent: reconciliation,
        reason: "parent_chain_broken"
      }
```

### FR-11 — Undo Task Creation

```
TRIGGER: UNDO where target event type == TASK_CREATED

ENGINE:
  find all events where causedBy == target_event.id
  for each child event (they were created after this parent):
    emit reverse event with intent: reconciliation
  emit logical removal of created task
```

### FR-12 — Undo Task Update

```
TRIGGER: UNDO where target event type == TASK_UPDATED

ENGINE:
  read target_event.previousState
  emit TASK_UPDATED {
    payload: previousState,
    intent: reconciliation,
    causedBy: undo_event.id
  }
  no cascade required (status changes are not cascaded)
```

### FR-13 — Child Undo with Missing Parent

```
TRIGGER: UNDO where target event type == TASK_CREATED (child task)

ENGINE:
  check parent.status
  if parent is tombstoned or deleted:
    BLOCK undo
    emit TASK_ORPHAN_FLAGGED
    surface UI warning: "Cannot restore — parent task no longer exists"
  else:
    proceed with standard undo
```

### FR-14 — Redo Symmetry

Every undo operation must have a corresponding redo that:
- Reapplies all events that were reversed
- Including all cascade tombstones and resurrections
- Restores child states to exactly what they were at that point in history
- Uses `previousState` stored on tombstone events as the restoration source

---

## 4.4 Time-Travel State

### FR-15 — Event Log as Source of Truth

```
AppState {
  eventLog:  Event[]     // append-only, never mutated
  cursor:    number      // current position in time
}

currentTaskTree = derive(eventLog, cursor)
  → replay all events up to cursor position
  → filter tombstoned tasks from active view
```

### FR-16 — Cursor Movement

- `undo()` → `cursor -= 1` (minimum: 0)
- `redo()` → `cursor += 1` (maximum: eventLog.length - 1, user_action events only)
- `seek(n)` → `cursor = n` (slider drag)
- New user action when `cursor < head`: truncate all events after cursor, append new event

### FR-17 — Branch Truncation

When the user performs a new action after undoing:
- All events at positions `> cursor` are permanently discarded
- New event appended as new head
- This is **irreversible** — a confirmation dialog is shown if truncation would discard more than 3 events

### FR-18 — Slider Behavior

- Slider spans positions `0` to `N` where N = count of `user_action` events only
- Cascade events (`cascade_from_parent`, `resurrection`) are **not** exposed as slider positions
- Each slider tick shows `actionLabel` in a tooltip
- Dragging slider in real-time updates the task tree view
- Current position is visually highlighted

---

## 4.5 History & Debug Views

### FR-19 — History Log Panel

- Lists all events where `intent.reason == "user_action"` in chronological order
- Shows: `actionLabel`, `timestamp`, task title
- Current cursor position is highlighted
- Clicking any entry seeks cursor to that position

### FR-20 — Debug Inspector Panel (Developer View)

- Lists **all** events including cascades, tombstones, resurrections
- Shows full event object: `type`, `intent`, `causedBy`, `previousState`
- Color-coded by intent type:
  - Blue: `user_action`
  - Orange: `cascade_from_parent`
  - Green: `resurrection`
  - Red: `orphan_flagged`
- Toggled via a developer mode switch

---

# 5. Non-Functional Requirements

### NFR-01 — State Integrity Invariants (must never be violated)
1. No active task may reference a `parentId` that is tombstoned or deleted
2. Every `TASK_TOMBSTONED` event must have a `causedBy` pointing to a `TASK_DELETED` event
3. Every `TASK_RESURRECTED` event must have a corresponding `TASK_TOMBSTONED` in the log
4. `previousState` must be populated on all mutating events
5. The derived task tree at any cursor position must be internally consistent

### NFR-02 — Performance
- State derivation (replay) must complete in < 100ms for up to 500 events
- Slider drag must update UI in real-time without debounce lag > 16ms
- Memoize derived state per cursor position to avoid full replays on repeated seeks

### NFR-03 — Memory
- Event log capped at 200 user-action events by default (configurable)
- On cap: oldest events pruned, base snapshot created at pruning point to maintain derivability

### NFR-04 — Consistency
- All events in a single user action (including cascades) must be committed atomically
- Partial commits are not permitted — all or nothing

---

# 6. Data Model

## 6.1 Core Types

```
Task (derived — never stored directly)
  id:           uuid
  title:        string
  description:  string | null
  status:       "todo" | "in-progress" | "done" | "tombstoned" | "orphan_flagged"
  parentId:     uuid | null
  createdAt:    datetime

TaskDelta (payload on events)
  Partial<Task>   // only fields that changed

Event
  id:            uuid
  type:          EventType
  timestamp:     datetime
  actionLabel:   string
  payload:       TaskDelta
  intent:        Intent
  causedBy:      uuid | null
  previousState: Partial<Task> | null

Intent
  reason:        "user_action" | "cascade_from_parent" | "reconciliation" | "resurrection"
  sourceEventId: uuid | null

AppState
  eventLog:      Event[]
  cursor:        number
```

---

# 7. UI Requirements

## 7.1 Layout

```
┌─────────────────────────────────────────────┐
│  Header: App title + Undo / Redo buttons    │
├───────────────────┬─────────────────────────┤
│                   │                         │
│  Task Tree        │  History Log Panel      │
│  (main view)      │  (user events only)     │
│                   │                         │
│                   ├─────────────────────────┤
│                   │  Debug Inspector        │
│                   │  (toggle, dev mode)     │
├───────────────────┴─────────────────────────┤
│  Timeline Slider ──────────●────────────    │
│  T0   T1   T2   T3   T4   T5   T6   T7     │
└─────────────────────────────────────────────┘
```

## 7.2 Task Tree

- Indented hierarchy, collapsible nodes
- Each task shows: title, status badge, child count (if parent)
- Action buttons per task: Edit, Complete, Delete
- Tombstoned tasks not shown in this view
- Orphan-flagged tasks shown with warning icon and distinct style

## 7.3 Timeline Slider

- Horizontal, full-width
- One tick per user-action event
- Tooltip on hover: `actionLabel` + timestamp
- Current position: filled circle indicator
- Future positions (undone events): greyed out
- Keyboard: Left/Right arrow keys move cursor ±1

## 7.4 Undo / Redo Controls

- Undo button: disabled at cursor = 0
- Redo button: disabled at cursor = head
- Both show tooltip with what action will be undone/redone
- Keyboard: `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`)

## 7.5 Confirmation Dialogs

- **Delete with children:** "Deleting this task will also remove 3 child tasks. This can be undone. Confirm?"
- **Branch truncation:** "Performing this action will discard 4 future states. Continue?"
- **Orphan block:** "Cannot restore this task — its parent no longer exists in the current timeline."

---

# 8. Reconciliation Strategy Decision

**Chosen strategy: Cascade Tombstone with Intent-Tracked Resurrection**

This was selected over the three original candidates for these reasons:

| Strategy | Rejected Reason |
|---|---|
| Hard delete children | Redo cannot recover children — asymmetric, lossy |
| Detach / promote to root | Changes task ownership semantics silently, ambiguous UX |
| Mark invalid (flat) | Doesn't track *why* invalid, resurrection is a guess |
| **Tombstone + intent log** | ✓ Fully reversible, resurrection is exact, why is always known |

The tombstone strategy is lossless precisely because `previousState` is captured at tombstone time — resurrection never guesses, it always restores to the last known user-intentional state.

---

# 9. Build Order

| Phase | Deliverable | Why First |
|---|---|---|
| 1 | Event log data model + intent schema | Everything derives from this |
| 2 | Reconciliation engine (pure functions) | Must be correct before UI exists; fully unit-testable |
| 3 | State derivation (replay engine) | Powers all views |
| 4 | Task CRUD wired through event log | No direct state mutation — all via events |
| 5 | Undo / redo cursor logic + branch truncation | Builds on event log |
| 6 | Task tree rendering (derived view) | Pure projection of derived state |
| 7 | Timeline slider + history log panel | Purely presentational |
| 8 | Debug inspector panel | Presentational, reads raw event log |
| 9 | Confirmation dialogs + keyboard shortcuts | Polish |

---

# 10. Open Questions

Now let me answer these Open Questions with careful reasoning based directly on the PRD and the stated project goals.

***

# Open Questions — Answered with Rationale

These five open questions are answered against the PRD's stated design philosophy: **event log is the only source of truth, every event carries intent, reconciliation is explicit, and undo/redo must be perfectly symmetric.**

***

## OQ-01 — Should completing all children auto-complete the parent?

**Answer: No. Do not implement auto-complete for the parent.**

The PRD explicitly states in FR-02: *"Changing a parent's status does not auto-cascade to children (children are status-independent)."* The symmetric rule means the reverse must also hold — children must not auto-cascade status changes upward to the parent. This is the **bidirectional independence principle**.

Here's why breaking it causes reconciliation problems:

- If completing all 3 children auto-completes the parent, you now have a `TASK_COMPLETED` event on the parent that was **not user-initiated** — it has no `user_action` intent. It would need a new intent type like `computed_from_children`, which isn't in the schema and adds reconciliation surface area.
- When any single child is then undone back to `todo`, you'd need to auto-reopen the parent — another cascade event. Now undo/redo of a single child task silently mutates the parent, violating the principle that parent and child statuses are independent.
- The time-travel slider would show the parent status changing at points the user never touched, which breaks the predictability of the history panel.

**If you want this behavior in a future version**, implement it as a user-configurable rule with its own event type (`TASK_AUTO_COMPLETED`, intent: `computed_from_children`) so the history log can surface it clearly. For v1, keep status changes strictly user-initiated.

***

## OQ-02 — Should orphan-flagged tasks be manually re-parentable?

**Answer: No for v1, but architect the schema to allow it in v2.**

The reason to exclude it from v1 is complexity: re-parenting an orphan requires a new event type (`TASK_REPARENTED`), new reconciliation logic to verify the new parent exists and is not tombstoned, and a UI flow to let the user pick a new parent from the active task tree. That's a meaningful scope addition.

The reason to leave the door open is that the orphan state is the worst UX in the system. An orphaned task is visible, carries a warning, but the user has no resolution path other than deleting it. In a real usage session that's friction.

**The safe v1 decision:** Allow the user to only **delete** an orphan-flagged task (not re-parent, not complete it). Deleting an orphan emits `TASK_DELETED` with `intent: user_action` and is fully undoable. The orphan warning message in the UI should explicitly say: *"You can delete this task or navigate the timeline to a state where the parent exists."* This gives users a clear path without adding new event types.

For v2, the re-parenting event schema would look like:
```
TASK_REPARENTED {
  payload: { newParentId, previousParentId },
  intent: { reason: "user_action" },
  previousState: { parentId: oldParentId }
}
```

***

## OQ-03 — Should history be exportable / importable (JSON)?

**Answer: Export yes, import no for v1.**

**Export** is low-risk and high-value. Since the event log is already the single source of truth and already structured as `Event[]`, exporting it is a simple `JSON.stringify(appState.eventLog)` call. It costs almost nothing to implement and gives users a way to save their work despite the in-memory constraint. This directly addresses the NFR-03 concern about the 200-event cap — export gives users a manual escape hatch before pruning occurs.

**Import is a different story.** Importing a JSON event log requires:
1. Schema validation of every event in the incoming log
2. Re-running the reconciliation engine against the imported events to verify consistency
3. A trust model — what happens if the imported log has corrupted `previousState` values or broken `causedBy` chains?

Import introduces a persistence layer concern (where does the file come from?) and a security surface (malformed input) that NFR-03 explicitly defers. It also creates a fork in the mental model: is the system in-memory-only, or is it a file-based system with JSON as its format? That question needs an explicit product decision.

**Decision: Ship export in v1 as a developer/power-user feature (a button in the Debug Inspector Panel). Defer import to v2 with proper schema validation.**

***

## OQ-04 — What is the max tree depth? Unbounded or capped?

**Answer: Soft-cap at depth 8, warn at depth 6, never hard-block.**

Here's the reasoning from both the performance and UX angles:

**Performance (NFR-02):** State derivation must complete in < 100ms for up to 500 events. Depth itself doesn't affect event log length — that's determined by the number of operations, not tree depth. However, **deletion cascade** is O(n) on the number of descendants. A 10-level deep tree where each node has 3 children has over 88,000 nodes at depth 10. Depth caps protect against accidental runaway cascades.

**UI rendering (FR-05):** The task tree is indented by 24px per level. At depth 8 on a 1200px screen, you've consumed 192px of indentation, leaving \~1000px for the task content — still workable. At depth 12+, the tree becomes visually unreadable and the task content gets squished.

**The recommended approach:**
- **Depth 1–5**: Normal behavior, no warnings
- **Depth 6**: Show a subtle inline hint: *"Deep nesting detected — consider restructuring"*
- **Depth 8**: Warn on task creation: *"This task will be nested 8 levels deep. Continue?"* (a non-blocking confirmation)
- **No hard block**: Never silently refuse to create a task — the user always has agency. The system warns but complies.

This also has a clean interaction with the reconciliation engine: the cascade depth in FR-09 mirrors the tree depth, so capping tree depth at 8 effectively caps cascade depth at 8, protecting the atomicity guarantee in NFR-04.

***

## OQ-05 — Should branch truncation ever be recoverable?

**Answer: No. Truncation must be permanent and irreversible.**

This is the clearest answer of the five, and it traces directly back to the PRD's core architecture.

FR-15 defines the event log as **append-only, never mutated**. FR-17 says truncation is irreversible and recommends a confirmation dialog. Making truncation recoverable would require one of these approaches, all of which break the architecture:

1. **A "recycling bin" for truncated events** — these events would still exist in memory but outside the canonical log, creating a second shadow log that can contradict the primary log. The single-source-of-truth guarantee collapses.

2. **Snapshots before truncation** — storing a full snapshot of the pre-truncation state adds significant memory overhead (NFR-03 caps the log at 200 events precisely to control memory) and creates a second state derivation path.

3. **Soft-delete truncation marker** — events are marked "truncated" rather than removed, and a "restore" operation un-marks them. But then the invariant in FR-16 ("new action truncates all events after cursor") is violated — an undo/redo of an action that followed truncation would resurrect events from the old branch, which is a time paradox in the event model.

The clean, correct answer: **make the confirmation dialog more protective instead.** The dialog (Section 7.5 of the PRD) already warns when truncation discards more than 3 events. To reduce accidental truncation, raise that threshold, show a more detailed preview of what will be lost, and require the user to type a confirmation ("I understand" checkbox or similar) for large truncations (> 10 events). These UX improvements give users sufficient pause without compromising the architectural invariants.

***

## Decision Summary

| # | Question | Decision | Rationale Anchor |
|---|---|---|---|
| OQ-01 | Auto-complete parent when all children done? | **No** | Bidirectional status independence; cascade would need new intent type |
| OQ-02 | Orphans re-parentable? | **Delete-only in v1; design schema for v2** | Scope + new event type needed; delete gives a resolution path |
| OQ-03 | Export/import history JSON? | **Export in v1, import in v2** | Export is trivial; import needs validation + trust model |
| OQ-04 | Max tree depth? | **Soft-cap at 8, warn at 6** | Cascade safety + UI readability; never hard-block |
| OQ-05 | Branch truncation recoverable? | **No — strengthen the dialog instead** | Preserves append-only log; shadow log breaks single source of truth |
---

*This PRD is the complete specification for v1. All implementation decisions should trace back to a requirement defined here. Any deviation must be logged as a scope change.*