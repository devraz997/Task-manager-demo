import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function DebugInspectorPanel() {
  const eventLog = useAppStore(state => state.eventLog);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const getIntentColor = (reason: string) => {
    switch(reason) {
      case 'user_action': return 'var(--accent-blue)';
      case 'cascade_from_parent': return 'var(--accent-orange)';
      case 'resurrection': return 'var(--accent-green)';
      case 'reconciliation': return 'var(--text-muted)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="debug-panel">
      <div className="panel-header" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚙ Event Log — Debug View
        </span>
      </div>
      
      <div className="panel-content" style={{ padding: 0 }}>
        {eventLog.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Event log is empty
          </div>
        ) : (
          eventLog.map((event) => {
            const isExpanded = expandedRows.has(event.id);
            const intentColor = getIntentColor(event.intent.reason);
            
            return (
              <div 
                key={event.id}
                style={{
                  borderLeft: `3px solid ${intentColor}`,
                  borderBottom: '1px solid var(--border-color)',
                  background: isExpanded ? 'rgba(0,0,0,0.1)' : 'transparent',
                }}
              >
                <div 
                  onClick={() => toggleRow(event.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ padding: '2px 6px', borderRadius: 4, background: intentColor, color: '#fff', fontSize: '0.7rem', fontWeight: 600 }}>
                    {event.type.replace('TASK_', '')}
                  </div>
                  <div style={{ flex: 1, fontFamily: 'monospace' }}>
                    <div style={{ color: 'var(--text-primary)' }}>{event.actionLabel}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                      intent: {event.intent.reason} 
                      {event.causedBy && ` | causedBy: ${event.causedBy.substring(0, 8)}...`}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <pre style={{
                    margin: 0,
                    padding: '1rem',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--accent-green)',
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {JSON.stringify(event, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
