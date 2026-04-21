import { TimelineSlider } from './components/TimelineSlider.tsx';
import { Header } from './components/Header.tsx';
import { TaskTreePanel } from './components/TaskTree/TaskTreePanel.tsx';
import { HistoryLogPanel } from './components/Panels/HistoryLogPanel.tsx';

export function App() {

  return (
    <>
      <Header />
      
      <div className="main-layout">
        <TaskTreePanel />
        
        <div className="right-panel">
          <HistoryLogPanel />
        </div>
      </div>
      
      <TimelineSlider />
    </>
  );
}

export default App;
