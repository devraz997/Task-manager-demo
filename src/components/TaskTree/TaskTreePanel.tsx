import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { deriveTasks } from '../../engine/derivation';
import { TaskNode } from './TaskNode';
import { Plus } from 'lucide-react';

export function TaskTreePanel() {
  const eventLog = useAppStore(state => state.eventLog);
  const cursor = useAppStore(state => state.cursor);
  const dispatch = useAppStore(state => state.dispatch);

  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Re-derive the whole tree for the given curson position
  const activeTasksMap = useMemo(() => deriveTasks(eventLog, cursor), [eventLog, cursor]);

  const allTasks = Array.from(activeTasksMap.values());
  const rootTasks = allTasks.filter(t => {
    if (t.status === 'tombstoned') return false;
    if (t.parentId === null) return true;
    const parent = activeTasksMap.get(t.parentId);
    if (!parent || parent.status === 'tombstoned') return true; // Orphan!
    return false;
  });

  const handleCreateRoot = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      dispatch({ type: 'CREATE', title: newTitle.trim() });
      setNewTitle('');
      setIsCreatingRoot(false);
    }
  };

  return (
    <div className="task-tree-panel">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Active Tasks</h2>
        <button className="primary-btn" onClick={() => setIsCreatingRoot(true)}>
          <Plus size={18} /> New Task
        </button>
      </div>

      {isCreatingRoot && (
        <form onSubmit={handleCreateRoot} className="task-node" style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            autoFocus
            type="text" 
            placeholder="What needs to be done?" 
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="primary-btn">Save</button>
          <button type="button" className="icon-btn" onClick={() => setIsCreatingRoot(false)}>Cancel</button>
        </form>
      )}

      {rootTasks.length === 0 && !isCreatingRoot ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <p>No tasks yet. Create your first task to get started.</p>
        </div>
      ) : (
        <div>
          {rootTasks.map(task => (
            <TaskNode key={task.id} task={task} depth={1} activeTasksMap={activeTasksMap} />
          ))}
        </div>
      )}
    </div>
  );
}
