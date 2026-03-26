import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const SUGGESTIONS = [
  '91150187 - Find journal entry linked to this?',
  'How many sales orders are there?',
  'Show cancelled billing documents',
  'Orders delivered but not billed',
  'Top customers by revenue',
  'Total billed revenue',
];

function DataTable({ data }) {
  if (!data || data.length === 0) return null;
  const keys = Object.keys(data[0]).slice(0, 6);
  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>{keys.map(k => <th key={k}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((row, i) => (
            <tr key={i}>
              {keys.map(k => (
                <td key={k} title={String(row[k] ?? '')}>
                  {String(row[k] ?? '').substring(0, 24)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 8 && (
        <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          Showing 8 of {data.length} results
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isAgent = msg.role === 'agent';
  return (
    <div className={`msg ${isAgent ? 'agent' : 'user'}`}>
      <div className="msg-avatar">{isAgent ? 'D' : 'U'}</div>
      <div className="msg-bubble">
        {msg.loading ? (
          <span className="thinking-dots">
            Analyzing<span>.</span><span>.</span><span>.</span>
          </span>
        ) : (
          <>
            <ReactMarkdown>{msg.text}</ReactMarkdown>
            {msg.data && msg.data.length > 0 && <DataTable data={msg.data} />}
            {msg.sql && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  ### Query Used
                </summary>
                <pre><code>{msg.sql}</code></pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatPane({ isOpen, onHighlight }) {
  const [messages, setMessages] = useState([
    {
      role: 'agent',
      text: 'Hi! I can help you analyze the **Order to Cash** process.\n\nAsk me anything about sales orders, billing documents, deliveries, payments, or journal entries.',
      data: [],
      sql: ''
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const extractIds = useCallback((data) => {
    if (!data || !Array.isArray(data)) return [];
    const ids = new Set();
    for (const row of data) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'string' && /^\d{6,}$/.test(v)) ids.add(v);
        if (k === 'accountingDocument' || k === 'billingDocument' || k === 'salesOrder' || k === 'deliveryDocument') {
          if (v) ids.add(String(v));
        }
      }
    }
    return [...ids];
  }, []);

  const sendMessage = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    // Add loading indicator
    const loadingId = Date.now();
    setMessages(prev => [...prev, { role: 'agent', loading: true, id: loadingId }]);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const res = await axios.post(`${API_URL}/chat`, { message: msg });
      const { answer, sql, data } = res.data;

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { role: 'agent', text: answer || 'No response', sql: sql || '', data: data || [] }
          : m
      ));

      // Highlight matching graph nodes
      const ids = extractIds(data);
      if (onHighlight) onHighlight(ids);

    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { role: 'agent', text: `❌ Error: ${e.message}. Make sure the backend is running.`, sql: '', data: [] }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }, [loading, extractIds, onHighlight]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className={`chat-pane ${isOpen ? '' : 'collapsed'}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">Chat with Graph</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Order to Cash</div>
        <div className="agent-identity">
          <div className="agent-avatar">D</div>
          <div>
            <div className="agent-name">Dodge AI</div>
            <div className="agent-role">Graph Agent</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <Message key={msg.id || i} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Status */}
      <div className="status-bar">
        <div className="status-dot" />
        <span>Dodge AI is awaiting instructions</span>
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="suggested-queries">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="sugg-btn" onClick={() => sendMessage(s)}>
              {s.length > 28 ? s.substring(0, 28) + '…' : s}
            </button>
          ))}
        </div>
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Analyze anything"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="14" y1="2" x2="7" y2="9"/>
              <polyline points="14,2 10,14 7,9 2,6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
