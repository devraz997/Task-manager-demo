import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

export function TimelineSlider() {
  const eventLog = useAppStore(state => state.eventLog);
  const cursor = useAppStore(state => state.cursor);
  const seek = useAppStore(state => state.seek);
  const getIndices = useAppStore(state => state.getUserActionEventIndices);

  const userActionIndices = useMemo(() => getIndices(), [getIndices, eventLog.length]);
  const totalTicks = userActionIndices.length;

  // The active 'tick' index logic: 
  // if cursor is 0, we are at tick 0 (before everything).
  // if cursor > userActionIndices[0], we are at at least tick 1.
  let activeTick = 0;
  for (let i = 0; i < userActionIndices.length; i++) {
    if (cursor > userActionIndices[i]) {
      activeTick = i + 1;
    }
  }

  // Calculate percentage for the progress line
  const percentage = totalTicks === 0 ? 0 : (activeTick / totalTicks) * 100;

  return (
    <div className="timeline-bar">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          State {activeTick} of {totalTicks}
        </span>
        {activeTick > 0 && (
          <span style={{ fontWeight: 600 }}>
            {eventLog[userActionIndices[activeTick - 1]]?.actionLabel}
          </span>
        )}
        <span style={{ minWidth: 80 }}></span>
      </div>

      <div className="timeline-track">
        <div className="timeline-line" />
        <div className="timeline-progress" style={{ width: `${percentage}%` }} />
        
        {/* Origin tick (0) */}
        <div 
          className={`tick ${activeTick === 0 ? 'active' : 'past'}`}
          style={{ left: '0%' }}
          onClick={() => seek(0)}
          title="Initial State"
        />

        {/* User action ticks */}
        {userActionIndices.map((logIndex, index) => {
          const tickIndex = index + 1;
          const isActive = activeTick === tickIndex;
          const isPast = activeTick > tickIndex;
          const pos = (tickIndex / totalTicks) * 100;
          
          return (
            <div
              key={logIndex}
              className={`tick ${isActive ? 'active' : isPast ? 'past' : ''}`}
              style={{ left: `${pos}%` }}
              onClick={() => seek(tickIndex)}
              title={eventLog[logIndex].actionLabel}
            />
          );
        })}
      </div>
    </div>
  );
}
