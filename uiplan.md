create Based on the PRD, here is a complete, detailed UI plan for the frontend of this application — covering every panel, component, state, interaction, and edge case.
Collaborative Task Manager — Frontend UI Plan
Foundational UI Architecture
This app has one core page (no routing needed for v1). The entire UI is a single-screen dashboard with five distinct zones that all react to one shared piece of state: the cursor position. Every visible element is a derived projection — nothing shows "stored" state. The UI layer is purely presentational; it reads from the derived task tree and event log, never writes to them directly.
Recommended Stack Posture:

React (component tree mirrors the task tree naturally)
Zustand or a Context + useReducer combo as the state container
All mutation functions live outside the UI (the reconciliation engine) — components only dispatch named commands
Overall Layout Grid
The layout is a 3-row, 2-column CSS Grid, fixed viewport height (no page scroll):


text
Row 1: Header Bar                   [full width, fixed height ~56px]Row 2: Task Tree | Right Panel      [flex-grow, takes remaining height]Row 3: Timeline Slider              [full width, fixed height ~80px]
The Right Panel itself is split vertically:

Top half: History Log Panel (always visible)
Bottom half: Debug Inspector Panel (toggleable, default hidden)
The split between right panel halves should be a draggable divider so users can resize them.
Zone 1: Header Bar
The header is a single horizontal strip with three logical groups.
Left Group — App Identity:

App name/logo: "TaskTime" (or whatever the product name is)
Subtle tagline like "Event-Sourced Task Manager" in muted text
Center Group — Undo / Redo Controls:

← Undo button
Disabled state: when cursor === 0
Enabled state: shows tooltip on hover — "Undo: [actionLabel of event at cursor]"
On click: dispatches undo() which decrements cursor
Redo → button
Disabled state: when cursor === head (no future events)
Enabled state: tooltip — "Redo: [actionLabel of next event]"
Greyed-out style (not just disabled) when no redo history exists
Keyboard bindings displayed as small badges on the buttons: Ctrl+Z, Ctrl+Y
Right Group — Dev Tools Toggle:

Toggle switch labeled "Dev Mode" with a ⚙ icon
When enabled: expands the Debug Inspector Panel below the History Log
Visual indicator (e.g., amber dot) when dev mode is active
Zone 2A: Task Tree (Left Panel)
This is the primary interaction surface. It renders the derived task tree at the current cursor position.

Tree Container
Vertically scrollable
Toolbar at the top with a single + New Task button (creates a root-level task)
Breadcrumb or depth indicator if the user has drilled down
Task Node — Anatomy
Each task row is a horizontal card with these elements from left to right:


text
[Expand Arrow] [Status Badge] [Title] ............. [Edit] [Complete] [Delete]               [Description line — muted, smaller font]               [Child count badge — if has children]
Expand Arrow:

Shown only if the task has children
Rotates 90° when expanded
Defaults to collapsed beyond depth 2 (per FR-05)
Smooth CSS transition on expand/collapse
Status Badge:

todo → light grey pill with text "To Do"
in-progress → blue pill with text "In Progress"
done → green pill with checkmark "Done"
orphan_flagged → amber/orange pill with warning icon "⚠ Orphaned"
Title:

Single line, truncated with ellipsis if too long
Clicking title opens the inline edit mode (see below)
done status: title has strikethrough styling
Child Count Badge:

Small grey bubble showing 3 subtasks next to the title if the task has active children
Action Buttons (right side, appear on row hover):

Edit (pencil icon) — opens inline edit or a side drawer
Complete (checkmark icon) — toggles between done/todo; icon changes based on current status
Delete (trash icon) — triggers confirmation dialog if children exist
Task Indentation
Each depth level is indented by 24px
A vertical line (connector) runs along the left edge of children to show grouping
Max depth is visually unlimited but the tree collapses beyond depth 2 by default
Orphan-Flagged Tasks
Shown in the tree with a distinct amber left border
Warning icon ⚠ before the title
Subtitle line in muted red: "Parent task no longer exists in this timeline"
Delete and Edit still available; Complete button is hidden
No child nesting shown under an orphan
Inline Task Creation
When + New Task or + Add Subtask is clicked:

A new row appears in the tree at the correct position
Text input is auto-focused
Fields: Title (required input), Description (optional collapsible textarea), Parent (auto-set from context)
Pressing Enter saves; Escape cancels
Saving dispatches TASK_CREATED through the reconciliation engine
Inline Edit Mode
Clicking Edit on an existing task:

Title becomes an editable input in-place
Description expands as a textarea below
Status becomes a dropdown select (todo, in-progress, done)
Save and Cancel buttons appear at the right
No separate modal needed — keeps context visible
Zone 2B: History Log Panel (Right Panel — Top Half)
This panel shows only user-initiated events (intent.reason === "user_action").

Panel Header
Title: "History"
Entry count: "12 events" in muted text
Clear visual separator from the task tree
History Entry Row
Each row represents one user event:


text
[●] [Icon] [actionLabel]              [timestamp]           [task title — muted]
[●] — filled circle shown only for the current cursor position (active event); others show an empty circle or timeline dot
[Icon] — event-type icon:
Created: + symbol
Updated: pencil
Completed: checkmark
Deleted: trash
Reopened: refresh icon
actionLabel — the human-readable label from the event (e.g., "Created 'Design homepage'")
timestamp — relative time (e.g., "2 min ago") with full ISO timestamp on hover tooltip
task title — the task name in muted smaller font below
Active State
The current cursor event row has a highlighted background (e.g., subtle blue tint)
A vertical timeline line runs along the left connecting all dots
Events after the current cursor are greyed out to indicate "future/undone" states
Interaction
Clicking any row calls seek(index) — moves cursor to that event
Hover shows a tooltip: "Click to jump to this state"
No delete or edit actions in this panel — it's read-only
Zone 2C: Debug Inspector Panel (Right Panel — Bottom Half)
Visible only when Dev Mode is toggled on. Shows the complete raw event log, including cascade events.

Panel Header
Title: "Event Log — Debug View" with a ⚙ icon
Filter pills at top: All | user_action | cascade | resurrection | orphan
Search input to filter by task title or event type
Debug Event Row
Each row is more information-dense than the history panel:


text
[COLOR BAR] [EventType Badge] [actionLabel]         [timestamp]            intent: cascade_from_parent | causedBy: [event-id truncated]            previousState: { status: "todo", title: "..." }
Color-coded left border by intent type:

🔵 Blue — user_action
🟠 Orange — cascade_from_parent
🟢 Green — resurrection
🔴 Red — orphan_flagged
Expandable row: clicking a row expands it to show the full raw event JSON in a monospace code block. This is the developer-facing view, so verbosity is acceptable.
causedBy link: if an event has a causedBy UUID, it renders as a clickable chip that scrolls to the referenced event in the same panel.
Zone 3: Timeline Slider
The full-width bottom bar is the most distinctive UI element of this product.

Slider Track
Horizontal track spanning the full width of the app
Tick marks for every user-action event (not cascade events — per FR-18)
Ticks are evenly spaced, labeled T0, T1, T2... below the track
The filled circle ● marker represents the current cursor position
Ticks to the right of the cursor are rendered in a grey/muted style
Slider Marker Behavior
Dragging the circle moves the cursor in real-time, updating the task tree as it moves
The tree re-derives state on every drag position change
No debounce — update must be real-time (per NFR-02, < 16ms lag)
Smooth CSS animation on the task tree rerender to avoid jarring jumps
Tick Tooltips
Hovering any tick shows a popover above it:


text
"Created 'Fix login bug'"April 21, 2026 · 3:42 PM
Keyboard Navigation
← / → arrow keys move the slider ±1 when the slider or timeline is focused
This should be visually reflected with a focus ring on the slider handle
Slider Labels
Below the track, a small label shows: State 5 of 12
Current actionLabel of the active event shown in the center above the track in bold
Confirmation Dialogs
Three distinct dialogs defined in the PRD, each with specific anatomy:

Dialog 1 — Delete with Children
Trigger: User clicks Delete on a task that has active children


text
╔══════════════════════════════════════════╗║  🗑 Delete Task                           ║║                                          ║║  Deleting "Fix login bug" will also      ║║  remove 3 child tasks:                   ║║    • Write test cases                    ║║    • Reproduce bug                       ║║    • Submit patch                        ║║                                          ║║  This action can be undone.              ║║                          [Cancel] [Delete]║╚══════════════════════════════════════════╝
Lists all affected children by name (depth-first)
The "This can be undone" line is critical reassurance text
Dialog 2 — Branch Truncation
Trigger: User performs a new action when cursor < head AND future events > 3


text
╔══════════════════════════════════════════╗║  ⚠ Discard Future States?                ║║                                          ║║  Creating this task will discard 4       ║║  future states that you navigated away   ║║  from. This cannot be recovered.         ║║                                          ║║  Future states that will be lost:        ║║    • Updated 'Homepage design'           ║║    • Completed 'Write copy'              ║║    • (+ 2 more)                          ║║                                          ║║                    [Cancel] [Continue]   ║╚══════════════════════════════════════════╝
Dialog 3 — Orphan Block
Trigger: User attempts an action on an orphan-flagged task


text
╔══════════════════════════════════════════╗║  ⛔ Cannot Restore Task                  ║║                                          ║║  The parent of "Write test cases" no     ║║  longer exists in the current timeline.  ║║                                          ║║  You can delete this task manually or    ║║  navigate to a timeline state where the  ║║  parent still exists.                    ║║                                          ║║                              [OK]        ║╚══════════════════════════════════════════╝
All dialogs use a modal overlay with backdrop blur, Escape to dismiss, and focus-trapped within the dialog for accessibility.
Visual State Mapping
Every possible task + cursor combination must have a clear visual treatment:

Task StateTree DisplayStyletodoShown normallyDefault white cardin-progressShown normallySubtle blue left borderdoneShown, strikethrough titleDimmed opacity, green badgetombstonedHidden from treeNot renderedorphan_flaggedShown with warningAmber border, ⚠ icon

Cursor PositionHistory PanelSliderFuture TicksAt headAll events normalAt rightmostNone greyedMid-historyFuture events greyedMid-positionGrey ticks to rightAt 0 (origin)All events greyedAt leftmostAll greyed
Component Breakdown (Implementation Guide)
These are the discrete components to build, in render hierarchy order:


text
<App>  <Header>    <AppLogo />    <UndoRedoControls />         ← cursor-aware, shows tooltips    <DevModeToggle />  </Header>  <MainLayout>    <TaskTreePanel>      <NewTaskButton />      <TaskNode />               ← recursive, renders children        <StatusBadge />        <TaskActions />          ← Edit / Complete / Delete        <InlineEditor />         ← conditionally rendered        <OrphanWarning />        ← conditionally rendered    </TaskTreePanel>    <RightPanel>      <HistoryLogPanel>        <HistoryEntry />         ← one per user_action event      </HistoryLogPanel>      <ResizeDivider />          ← draggable      <DebugInspectorPanel>      ← dev mode only        <FilterPills />        <DebugEventRow />        ← one per ALL events          <ExpandedEventJSON />  ← on click      </DebugInspectorPanel>    </RightPanel>  </MainLayout>  <TimelineBar>    <SliderTrack />    <SliderHandle />             ← draggable, real-time    <TickMark />                 ← one per user_action event    <CursorLabel />              ← "State 5 of 12 · Created 'Task'"  </TimelineBar>  <ConfirmationDialog />         ← modal portal, type-switched</App>
Empty & Edge States
Every zone needs a defined empty state:

Empty Task Tree: Large centered illustration with text "No tasks yet. Create your first task to get started." and a prominent + Create Task button.
Empty History Panel: "No actions recorded yet" in muted italic.
Slider at T0 (no events): Slider is rendered but disabled with a single dot at position 0.
All tasks deleted: Tree shows empty state even though the event log has entries — the derived state at that cursor is simply empty.
Responsive Behavior
Since this is v1 and single-user in-memory, desktop-first is acceptable. But define the breakpoint behavior:

> 1200px: Full 3-panel layout as specified
768–1200px: Right panel collapses into a tab switcher (History / Debug tabs)
< 768px: Timeline slider moves to a horizontal scrollable strip; right panel is a bottom sheet accessed via a button
Accessibility Checklist
All action buttons have aria-label (e.g., aria-label="Delete task: Fix login bug")
Dialogs use role="dialog" with aria-labelledby and aria-describedby
Timeline slider uses role="slider" with aria-valuenow, aria-valuemin, aria-valuemax
Color is never the only indicator of state (icons supplement all color coding)
Focus management: when a dialog closes, focus returns to the triggering element
Ctrl+Z / Ctrl+Y keyboard shortcuts must not conflict with browser defaults (use event.preventDefault() carefully)