# TaskTime — Event-Sourced Task Manager with Time Travel

A single-page collaborative task manager built with **React**, **Zustand**, and **Vite**. The defining feature is its **event-sourced architecture** — every mutation is recorded as an immutable event, enabling full undo/redo and a visual timeline slider to scrub through history in real time.

---

## ✨ Features

- **Hierarchical Task Management** — Create, edit, complete, and delete tasks with unlimited parent-child nesting
- **Event-Sourced State** — No direct state mutation; the event log is the single source of truth
- **Time-Travel Timeline** — A visual slider at the bottom lets you scrub to any point in history and see the task tree reconstruct live
- **Undo / Redo** — Full undo/redo powered by cursor movement through the event log
- **Intent-Aware Events** — Every event records *why* it happened (`user_action`, `cascade_from_parent`), not just *what* changed
- **Child Promotion on Delete** — Deleting a parent task promotes its children to root level instead of destroying them
- **History Panel** — A chronological log of all user-initiated actions, clickable to jump to any state
- **Branch Truncation** — Performing a new action after undoing discards the divergent future (with confirmation)

---

## 🏗 Architecture

```
src/
├── types.ts                          # Core type definitions
├── engine/
│   ├── reconciliation.ts             # Pure reconciliation engine
│   └── derivation.ts                 # State derivation (event replay)
├── store/
│   └── useAppStore.ts                # Zustand global store
├── components/
│   ├── Header.tsx                    # App header with undo/redo controls
│   ├── TimelineSlider.tsx            # Visual timeline scrubber
│   ├── TaskTree/
│   │   ├── TaskTreePanel.tsx         # Task list container
│   │   └── TaskNode.tsx              # Recursive task node component
│   └── Panels/
│       └── HistoryLogPanel.tsx       # User action history log
├── App.tsx                           # Root layout (3-row, 2-column grid)
├── main.tsx                          # React entry point
└── index.css                         # Design system & global styles
```

### Core Concepts

#### Event Log & Cursor

The entire application state is derived from two values:

```typescript
interface AppState {
  eventLog: TimelineEvent[];  // append-only, never mutated
  cursor: number;             // current position in time
}
```

The visible task tree is always a **projection** — computed by replaying all events from index `0` to `cursor`. There is no stored "current state."

#### Reconciliation Engine (`src/engine/reconciliation.ts`)

A **pure function** that sits between user actions and the event log. It receives a proposed action and returns the full set of events to commit atomically. For example, deleting a parent task produces:

1. `TASK_DELETED` — the user's action
2. `TASK_DETACHED` × N — one per immediate child, promoted to root (cascade)

All cascade events carry `intent: { reason: 'cascade_from_parent' }` and a `causedBy` link to the originating user event, preserving the causal chain.

#### Derivation Engine (`src/engine/derivation.ts`)

Replays events up to the cursor position to build a `Map<string, Task>`. Each event type has defined behavior:

| Event Type | Derivation Effect |
|---|---|
| `TASK_CREATED` | Adds a new task to the map |
| `TASK_UPDATED` | Merges changed fields into the existing task |
| `TASK_COMPLETED` | Sets status to `done` |
| `TASK_REOPENED` | Sets status to `todo` |
| `TASK_DELETED` | Removes the task from the map entirely |
| `TASK_DETACHED` | Sets `parentId` to `null` (promotes to root) |
| `TASK_TOMBSTONED` | Merges tombstone status (kept for future resurrection support) |
| `TASK_RESURRECTED` | Re-creates the task from stored `previousState` |

#### Undo / Redo / Seek

- **Undo**: Moves cursor backward to the previous `user_action` event boundary
- **Redo**: Moves cursor forward to the next `user_action` event boundary
- **Seek**: Jumps cursor to any user-action tick on the timeline
- **Branch Truncation**: Performing a new action while `cursor < head` permanently discards all future events

---

## 📦 Data Model

### Task (derived — never stored)

```typescript
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in-progress" | "done" | "tombstoned" | "orphan_flagged";
  parentId: string | null;
  createdAt: string;
}
```

### TimelineEvent

```typescript
interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string;
  actionLabel: string;           // human-readable label for history UI
  payload: Partial<Task>;        // fields that changed
  intent: {
    reason: "user_action" | "cascade_from_parent" | "reconciliation" | "resurrection";
    sourceEventId: string | null;
  };
  causedBy: string | null;       // direct parent event in causal chain
  previousState: Partial<Task> | null;  // snapshot before mutation
}
```

---

## 🖥 UI Layout

```
┌─────────────────────────────────────────────────┐
│  Header: TaskTime    [← Undo] [Redo →]          │
├──────────────────────┬──────────────────────────┤
│                      │                          │
│  Task Tree           │  History Log Panel       │
│  (derived view)      │  (user events only)      │
│                      │                          │
├──────────────────────┴──────────────────────────┤
│  Timeline Slider ───────────●───────────────    │
│  State 5 of 12 · "Created 'Design homepage'"   │
└─────────────────────────────────────────────────┘
```

- **Task Tree** — Indented hierarchy with inline editing, expand/collapse, and action buttons (edit, complete, delete, add subtask) that appear on hover
- **History Panel** — Chronological list of user actions; clicking an entry jumps to that state
- **Timeline Slider** — Tick marks for each user action; clicking or dragging scrubs history in real time

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
cd "Task manager demo"
npm install
npm run dev
```

The development server starts at `http://localhost:5173` (or the next available port).

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build Tool | Vite 8 |
| State Management | Zustand 5 |
| Icons | Lucide React |
| IDs | uuid v14 |
| Language | TypeScript 6 |
| Styling | Vanilla CSS (dark theme, CSS custom properties) |

---

## 📝 Design Decisions

1. **Event log is the only source of truth** — Current state is always a derived projection, never stored directly
2. **Every event carries intent** — The system always knows whether a change was user-initiated or system-cascaded
3. **Reconciliation is explicit** — A dedicated engine runs before every commit, resolving all side-effects
4. **Child promotion over cascade delete** — Deleting a parent promotes children to root instead of destroying them, preserving work
5. **In-memory only (v1)** — No backend persistence; refreshing the page resets state

---

## 📄 License

This project is for demonstration purposes.
