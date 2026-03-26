import axios from 'axios';

const API = 'http://localhost:3001/api/node';

const TYPE_COLORS = {
  SalesOrder:   { bg: 'rgba(77, 124, 254, 0.15)', border: '#4d7cfe', text: '#4d7cfe' },
  BillingDoc:   { bg: 'rgba(255, 159, 67, 0.15)', border: '#ff9f43', text: '#ff9f43' },
  JournalEntry: { bg: 'rgba(34, 211, 160, 0.15)', border: '#22d3a0', text: '#22d3a0' },
  Delivery:     { bg: 'rgba(155, 109, 254, 0.15)', border: '#9b6dfe', text: '#9b6dfe' },
  Customer:     { bg: 'rgba(255, 92, 122, 0.15)', border: '#ff5c7a', text: '#ff5c7a' },
  Payment:      { bg: 'rgba(99, 230, 190, 0.15)', border: '#63e6be', text: '#63e6be' },
};

const IMPORTANT_FIELDS = {
  SalesOrder: ['totalNetAmount', 'overallDeliveryStatus', 'customerPaymentTerms', 'creationDate'],
  BillingDoc: ['totalNetAmount', 'accountingDocument', 'billingDocumentIsCancelled', 'billingDocumentDate'],
  JournalEntry: ['glAccount', 'amountInTransactionCurrency', 'referenceDocument', 'postingDate', 'accountingDocumentType'],
  Delivery: ['deliveryDate', 'overallDeliveryStatus', 'overallPickingStatus', 'soldToParty'],
  Customer: ['businessPartnerFullName', 'businessPartnerGrouping'],
  Payment: ['amountInTransactionCurrency', 'postingDate', 'customer'],
};

function formatFieldKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function formatValue(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? '✓ Yes' : '✗ No';
  if (key.toLowerCase().includes('date') && typeof val === 'string' && val.includes('T')) {
    return val.split('T')[0];
  }
  if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('netamount')) {
    const num = parseFloat(val);
    if (!isNaN(num)) return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }
  return String(val);
}

export default function NodeDetail({ node, pos, onClose }) {
  const colors = TYPE_COLORS[node.type] || { bg: 'rgba(136,144,175,0.15)', border: '#8890af', text: '#8890af' };
  
  // Get node data from local node object (already has most fields)
  const data = node;
  const importantKeys = IMPORTANT_FIELDS[node.type] || [];
  
  // All fields except graph internals
  const exclude = new Set(['id', 'type', 'label', 'val', 'x', 'y', 'vx', 'vy', 'fx', 'fy', '__indexColor', 'index']);
  const allFields = Object.entries(data).filter(([k]) => !exclude.has(k));
  const importantFields = allFields.filter(([k]) => importantKeys.includes(k));
  const otherFields = allFields.filter(([k]) => !importantKeys.includes(k));
  const shownOthers = otherFields.slice(0, 6);
  const totalHidden = allFields.length - importantFields.length - shownOthers.length;
  
  // Estimate connections
  const connections = node.connections || (importantFields.length + shownOthers.length) || 2;

  return (
    <div
      className="node-detail-card"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="node-card-header">
        <div
          className="node-type-badge"
          style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
        >
          <span>⬡</span>
          {node.type.replace(/([A-Z])/g, ' $1').trim()}
        </div>
        <button className="node-card-close" onClick={onClose}>×</button>
      </div>

      <div className="node-card-id">{node.id}</div>

      <div className="node-fields">
        {importantFields.map(([k, v]) => (
          <div key={k} className="node-field">
            <span className="field-key">{formatFieldKey(k)}</span>
            <span className="field-val important">{formatValue(k, v)}</span>
          </div>
        ))}
        {shownOthers.map(([k, v]) => (
          <div key={k} className="node-field">
            <span className="field-key">{formatFieldKey(k)}</span>
            <span className="field-val">{formatValue(k, v)}</span>
          </div>
        ))}
        {totalHidden > 0 && (
          <div className="hidden-fields-note">+ {totalHidden} additional fields hidden for readability</div>
        )}
      </div>

      <div className="node-card-footer">
        <span className="connections-count">Connections: <span>{connections}</span></span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Entity: {node.type}</span>
      </div>
    </div>
  );
}
