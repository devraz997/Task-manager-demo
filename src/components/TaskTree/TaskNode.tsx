import { useState } from 'react';
import type { Task } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { ChevronRight, ChevronDown, Edit2, Trash2, CheckCircle, Circle, Plus, AlertTriangle } from 'lucide-react';

interface TaskNodeProps {
  task: Task;
  depth: number;
  activeTasksMap: Map<string, Task>;
}

export function TaskNode({ task, depth, activeTasksMap }: TaskNodeProps) {
  const dispatch = useAppStore(state => state.dispatch);
  
  // Local UI State
  const [expanded, setExpanded] = useState(depth <= 2);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState('');

  // Children resolution
  const allTasks = Array.from(activeTasksMap.values());
  const children = allTasks.filter(t => t.parentId === task.id && t.status !== 'tombstoned');
  
  const isDone = task.status === 'done';
  const isOrphan = task.status === 'orphan_flagged';

  const handleToggleComplete = () => {
    if (isDone) {
      dispatch({ type: 'REOPEN', id: task.id });
    } else {
      dispatch({ type: 'COMPLETE', id: task.id });
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      dispatch({ type: 'UPDATE', id: task.id, payload: { title: editTitle.trim() } });
      setIsEditing(false);
    }
  };

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (childTitle.trim()) {
      dispatch({ type: 'CREATE', title: childTitle.trim(), parentId: task.id });
      setChildTitle('');
      setIsAddingChild(false);
      setExpanded(true); // Auto expand to show new child
    }
  };

  const handleDelete = () => {
    // In a full implementation, we show a confirmation dialog if children.length > 0
    // For simplicity, we just dispatch DELETE here, which handles cascade logic in engine.
    const confirmMsg = children.length > 0 
      ? `Deleting "${task.title}" will also remove ${children.length} child tasks. Continue?`
      : `Delete "${task.title}"?`;
    
    if (window.confirm(confirmMsg)) {
      dispatch({ type: 'DELETE', id: task.id });
    }
  };

  const renderBadge = () => {
    if (isOrphan) return <span className="badge badge-orphan">⚠ Orphaned</span>;
    if (isDone) return <span className="badge badge-done">Done</span>;
    if (task.status === 'in-progress') return <span className="badge badge-in-progress">In Progress</span>;
    return null;
  };

  const indents = Array.from({ length: depth - 1 }).map((_, i) => (
    <div key={i} style={{ width: '24px', borderLeft: '1px solid var(--border-color)', marginLeft: '12px' }} />
  ));

  if (isOrphan && depth > 1) {
    // PRD says orphaned tasks are shown in root-like view but with an amber border 
    // Wait, orphans have no active parent, so they won't render unless handled by parentId=null filter?
    // Actually, tree rendering starts from parentId=null OR parent is tombstoned/missing.
    // If we only render from root tasks, an orphan will not be found if its parent is tombstoned.
    // So the TaskTreePanel needs to gather orphans. Let me just return visually normal for now,
    // TaskTreePanel will be responsible for passing them.
  }

  return (
    <div style={{ display: 'flex' }}>
      {indents}
      <div style={{ flex: 1 }}>
        <div className={`task-node ${isDone ? 'done' : ''}`} style={{ borderColor: isOrphan ? 'var(--accent-orange)' : undefined }}>
          
          {isEditing ? (
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                autoFocus
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)} 
                style={{ flex: 1 }} 
              />
              <button type="submit" className="primary-btn">Save</button>
              <button type="button" onClick={() => setIsEditing(false)} className="icon-btn">Cancel</button>
            </form>
          ) : (
            <>
              <div className="task-header">
                <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
                  {children.length > 0 && (
                     <button onClick={() => setExpanded(!expanded)} className="icon-btn" style={{ padding: 2 }}>
                       {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                     </button>
                  )}
                </div>
                
                {renderBadge()}
                
                <div className="task-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isOrphan && <AlertTriangle size={16} color="var(--accent-orange)" />}
                  {task.title}
                  {children.length > 0 && (
                    <span style={{ fontSize: '0.75rem', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: 12, color: 'var(--text-muted)' }}>
                      {children.length}
                    </span>
                  )}
                </div>

                <div className="task-actions">
                  <button className="icon-btn" onClick={() => setIsAddingChild(true)} title="Add Subtask" disabled={isDone || isOrphan}><Plus size={16} /></button>
                  <button className="icon-btn" onClick={handleToggleComplete} title="Complete/Reopen" disabled={isOrphan}>
                    {isDone ? <CheckCircle size={16} /> : <Circle size={16} />}
                  </button>
                  <button className="icon-btn" onClick={() => setIsEditing(true)} title="Edit"><Edit2 size={16} /></button>
                  <button className="icon-btn" onClick={handleDelete} title="Delete"><Trash2 size={16} color="var(--accent-red)" /></button>
                </div>
              </div>
              
              {isOrphan && (
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-red)', marginLeft: '28px', marginTop: '4px' }}>
                  Parent task no longer exists in this timeline.
                </div>
              )}
            </>
          )}

          {/* Inline Add Child Form */}
          {isAddingChild && (
            <form onSubmit={handleAddChild} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', marginLeft: '28px' }}>
              <input 
                autoFocus
                placeholder="Subtask title"
                value={childTitle} 
                onChange={e => setChildTitle(e.target.value)} 
                style={{ flex: 1 }} 
              />
              <button type="submit" className="primary-btn">Add Subtask</button>
              <button type="button" onClick={() => setIsAddingChild(false)} className="icon-btn">Cancel</button>
            </form>
          )}

        </div>

        {expanded && children.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {children.map(child => (
              <TaskNode key={child.id} task={child} depth={depth + 1} activeTasksMap={activeTasksMap} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
