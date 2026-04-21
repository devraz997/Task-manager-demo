import { useState, useCallback, useEffect } from 'react';
import { TimelineSlider } from './components/TimelineSlider.tsx';
import { Header } from './components/Header.tsx';
import { TaskTreePanel } from './components/TaskTree/TaskTreePanel.tsx';
import { HistoryLogPanel } from './components/Panels/HistoryLogPanel.tsx';
import { History, X } from 'lucide-react';

export function App() {
  const [panelOpen, setPanelOpen] = useState(false);

  const togglePanel = useCallback(() => {
    setPanelOpen(prev => !prev);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // Close panel on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelOpen) {
        closePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen, closePanel]);

  return (
    <>
      <Header />
      
      <div className="main-layout">
        <TaskTreePanel />
        
        {/* Overlay backdrop for mobile/tablet */}
        <div 
          className={`panel-overlay ${panelOpen ? 'visible' : ''}`} 
          onClick={closePanel}
        />

        <div className={`right-panel ${panelOpen ? 'open' : ''}`}>
          <button 
            className="panel-close-btn" 
            onClick={closePanel}
            aria-label="Close history panel"
          >
            <X size={18} />
          </button>
          <HistoryLogPanel />
        </div>
      </div>
      
      {/* Floating button to open history panel on tablet/mobile */}
      <button 
        className="mobile-panel-toggle" 
        onClick={togglePanel}
        aria-label="Toggle history panel"
      >
        <History size={22} />
      </button>

      <TimelineSlider />
    </>
  );
}

export default App;
