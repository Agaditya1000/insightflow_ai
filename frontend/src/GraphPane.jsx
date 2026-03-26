import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import NodeDetail from './NodeDetail';

const NODE_COLORS = {
  SalesOrder:   '#4d7cfe',
  BillingDoc:   '#ff9f43',
  JournalEntry: '#22d3a0',
  Delivery:     '#9b6dfe',
  Customer:     '#ff5c7a',
  Payment:      '#63e6be',
};

const NODE_LABELS = {
  SalesOrder:   'Sales Order',
  BillingDoc:   'Billing Doc',
  JournalEntry: 'Journal Entry',
  Delivery:     'Delivery',
  Customer:     'Customer',
  Payment:      'Payment',
};

export default function GraphPane({ highlightIds, setSelectedNode }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clickedNode, setClickedNode] = useState(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDimensions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    axios.get(`${API_URL}/graph`)
      .then(r => {
        const { nodes, edges } = r.data;
        setGraphData({
          nodes: nodes.map(n => ({ ...n, val: n.type === 'Customer' ? 6 : n.type === 'SalesOrder' ? 4 : 3 })),
          links: edges.map(e => ({ source: e.source, target: e.target, type: e.type }))
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Highlight nodes when chat resolves IDs
  const highlightSet = new Set(highlightIds);

  // Auto-zoom to highlighted nodes
  useEffect(() => {
    if (highlightIds && highlightIds.length > 0 && fgRef.current && graphData.nodes.length > 0) {
      const hasNodes = graphData.nodes.some(n => highlightSet.has(n.id));
      if (hasNodes) {
        // Smoothly zoom to fit the highlighted nodes (1200ms duration, 80px padding)
        fgRef.current.zoomToFit(1200, 80, node => highlightSet.has(node.id));
      }
    } else if ((!highlightIds || highlightIds.length === 0) && fgRef.current && graphData.nodes.length > 0) {
      // Optional: zoom back out when cleared, but maybe better to let user control it
    }
  }, [highlightIds, graphData, highlightSet]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const isHighlighted = highlightSet.has(node.id);
    const isClicked = clickedNode?.id === node.id;
    const color = NODE_COLORS[node.type] || '#8890af';
    const r = node.val || 3;
    const size = isHighlighted ? r * 2.2 : isClicked ? r * 1.8 : r;

    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size * 1.8, 0, 2 * Math.PI);
      ctx.fillStyle = color + '33';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = isHighlighted ? color : isClicked ? color : color + 'cc';
    ctx.fill();

    if (isHighlighted || isClicked || globalScale > 2) {
      const label = node.id.substring(0, 10);
      ctx.font = `${10 / globalScale}px Inter, sans-serif`;
      ctx.fillStyle = '#e8eaf0';
      ctx.textAlign = 'center';
      ctx.fillText(label, node.x, node.y + size + 6 / globalScale);
    }
  }, [highlightSet, clickedNode]);

  const handleNodeClick = useCallback((node, event) => {
    setClickedNode(node);
    setSelectedNode(node);
    const rect = containerRef.current?.getBoundingClientRect() || {};
    let x = event.clientX - (rect.left || 0) + 12;
    let y = event.clientY - (rect.top || 0) - 20;
    // Keep card in bounds
    if (x + 320 > dimensions.width) x = dimensions.width - 330;
    if (y + 320 > dimensions.height) y = dimensions.height - 330;
    if (y < 0) y = 8;
    setCardPos({ x, y });
  }, [setSelectedNode, dimensions]);

  const handleBgClick = useCallback(() => {
    setClickedNode(null);
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <div className="graph-pane" ref={containerRef}>
      {loading && (
        <div className="graph-loading">
          <div className="spinner" />
          <span>Loading O2C graph…</span>
        </div>
      )}
      {error && (
        <div className="graph-loading">
          <span style={{ color: 'var(--accent-red)' }}>⚠ {error}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Make sure the backend is running on port 3001</span>
        </div>
      )}
      {!loading && !error && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor="#0f1117"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          linkColor={() => 'rgba(77, 124, 254, 0.25)'}
          linkWidth={0.6}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBgClick}
          cooldownTicks={120}
          d3AlphaDecay={0.015}
          d3VelocityDecay={0.4}
          nodeLabel={() => ''}
        />
      )}

      {/* Legend */}
      {!loading && !error && (
        <div className="graph-legend">
          {Object.entries(NODE_LABELS).map(([type, label]) => (
            <div key={type} className="legend-item">
              <div className="legend-dot" style={{ background: NODE_COLORS[type] }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Node Detail Card */}
      {clickedNode && (
        <NodeDetail
          node={clickedNode}
          pos={cardPos}
          onClose={() => { setClickedNode(null); setSelectedNode(null); }}
        />
      )}
    </div>
  );
}
