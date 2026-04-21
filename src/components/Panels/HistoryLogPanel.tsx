import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Plus, Edit2, CheckCircle, Trash2, RotateCcw } from 'lucide-react';

export function HistoryLogPanel() {
  const eventLog = useAppStore(state => state.eventLog);
  const cursor = useAppStore(state => state.cursor);
  const seek = useAppStore(state => state.seek);
  const getUserActionEventIndices = useAppStore(state => state.getUserActionEventIndices);
  const userActionIndices = useMemo(() => getUserActionEventIndices(), [getUserActionEventIndices, eventLog.length]);

  // Wait, history log shows user_action. But PRD FR-19 says "Lists all events where intent.reason == 'user_action'".
  const userEvents = userActionIndices.map(index => ({
    event: eventLog[index],
    logIndex: index,
    tickIndex: userActionIndices.indexOf(index) + 1,
  })).reverse(); // show newest at top usually? PRD says chronological. "chronological order".
  
  // Actually let's use chronological (oldest to newest) since it matches timeline left-to-right.
  const chronologicalEvents = [...userEvents].reverse();

  const getIcon = (type: string) => {
    switch(type) {
      case 'TASK_CREATED': return <Plus size={16} />;
      case 'TASK_UPDATED': return <Edit2 size={16} />;
      case 'TASK_COMPLETED': return <CheckCircle size={16} />;
      case 'TASK_DELETED': return <Trash2 size={16} />;
      case 'TASK_REOPENED': return <RotateCcw size={16} />;
      default: return <Edit2 size={16} />;
    }
  };

  return (
    <div className="history-panel">
      <div className="panel-header">
        <span>History</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {userEvents.length} events
        </span>
      </div>
      
      <div className="panel-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {chronologicalEvents.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No actions recorded yet
          </div>
        ) : (
          chronologicalEvents.map(({ event, logIndex, tickIndex }) => {
            const isFuture = logIndex >= cursor;
            // The active user event is the one the cursor just passed
            // If cursor > logIndex, this event is applied. 
            // The "Active State" = the one immediately preceding the cursor.
            let nextUserEventIndex = chronologicalEvents.find(e => e.logIndex >= cursor)?.logIndex ?? eventLog.length;
            const isActive = logIndex < cursor && nextUserEventIndex > logIndex;

            return (
               <div 
                  key={event.id}
                  onClick={() => seek(tickIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    background: isActive ? 'var(--bg-panel-hover)' : 'transparent',
                    opacity: isFuture ? 0.5 : 1,
                    borderLeft: isActive ? '3px solid var(--accent-blue)' : '3px solid transparent'
                  }}
               >
                 <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                   {getIcon(event.type)}
                 </div>
                 <div style={{ flex: 1 }}>
                   <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{event.actionLabel}</div>
                   {event.payload.title && (
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{event.payload.title as string}</div>
                   )}
                 </div>
                 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </div>
               </div>
            );
          })
        )}
      </div>
    </div>
  );
}
