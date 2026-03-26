import { useState, useCallback } from 'react';
import GraphPane from './GraphPane';
import ChatPane from './ChatPane';

export default function App() {
  const [chatOpen, setChatOpen] = useState(true);
  const [highlightIds, setHighlightIds] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  const handleHighlight = useCallback((ids) => {
    setHighlightIds(ids);
  }, []);

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <button className="sidebar-toggle" title="Toggle sidebar">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="2" width="14" height="2" rx="1"/>
            <rect x="1" y="7" width="14" height="2" rx="1"/>
            <rect x="1" y="12" width="14" height="2" rx="1"/>
          </svg>
        </button>
        <div className="header-nav">
          <span>Mapping</span>
          <span className="separator">/</span>
          <span className="breadcrumb-final">Order to Cash</span>
        </div>
        <div className="header-controls">
          <button className="ctrl-btn">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1L1 4v5c0 3.3 3 5.9 7 7 4-1.1 7-3.7 7-7V4L8 1z"/>
            </svg>
            Minimize
          </button>
          <button className="ctrl-btn" onClick={() => setChatOpen(o => !o)}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="3"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4"/>
            </svg>
            {chatOpen ? 'Hide' : 'Show'} Granular Overlay
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="main-content">
        <GraphPane
          highlightIds={highlightIds}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
        />
        <ChatPane
          isOpen={chatOpen}
          onHighlight={handleHighlight}
        />
      </div>
    </div>
  );
}
