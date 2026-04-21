import { TimelineSlider } from './components/TimelineSlider';
import { Header } from './components/Header';
import { TaskTreePanel } from './components/TaskTree/TaskTreePanel';
import { HistoryLogPanel } from './components/Panels/HistoryLogPanel';

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
