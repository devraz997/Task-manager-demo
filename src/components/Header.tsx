import { Undo2, Redo2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function Header() {
  const eventLog = useAppStore(state => state.eventLog);
  const cursor = useAppStore(state => state.cursor);
  const undo = useAppStore(state => state.undo);
  const redo = useAppStore(state => state.redo);

  const canUndo = cursor > 0;
  const canRedo = cursor < eventLog.length;

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'flex-baseline', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>TaskTime</h1>
        <span style={{ color: 'var(--text-muted)' }}>Event-Sourced Task Manager</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button 
          className="icon-btn" 
          disabled={!canUndo} 
          onClick={undo}
          title={canUndo ? "Undo" : ""}
        >
          <Undo2 size={20} />
        </button>
        <button 
          className="icon-btn" 
          disabled={!canRedo} 
          onClick={redo}
          title={canRedo ? "Redo" : ""}
        >
          <Redo2 size={20} />
        </button>
      </div>

      <div />
    </header>
  );
}
