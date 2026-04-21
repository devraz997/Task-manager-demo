import { useState } from 'react';

import { TimelineSlider } from './components/TimelineSlider';
import { Header } from './components/Header';
import { TaskTreePanel } from './components/TaskTree/TaskTreePanel';
import { HistoryLogPanel } from './components/Panels/HistoryLogPanel';
import { DebugInspectorPanel } from './components/Panels/DebugInspectorPanel';

export function App() {
  const [devMode, setDevMode] = useState(false);

  return (
    <>
      <Header devMode={devMode} toggleDevMode={() => setDevMode(!devMode)} />
      
      <div className="main-layout">
        <TaskTreePanel />
        
        <div className="right-panel">
          <HistoryLogPanel />
          {devMode && <DebugInspectorPanel />}
        </div>
      </div>
      
      <TimelineSlider />
    </>
  );
}

export default App;
