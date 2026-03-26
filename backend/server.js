require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { processQuery } = require('./query');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Graph Data Endpoint ─────────────────────────────────────────────────────
app.get('/api/graph', (req, res) => {
  try {
    const nodes = [];
    const edges = [];
    const nodeSet = new Set();

    function addNode(id, type, data) {
      if (!nodeSet.has(id)) {
        nodeSet.add(id);
        nodes.push({ id, type, label: id, ...data });
      }
    }

    // Sales Orders
    const so = db.prepare(`SELECT salesOrder, soldToParty, totalNetAmount, overallDeliveryStatus FROM sales_order_headers LIMIT 150`).all();
    for (const r of so) {
      addNode(r.salesOrder, 'SalesOrder', { amount: r.totalNetAmount, status: r.overallDeliveryStatus });
      if (r.soldToParty) {
        addNode(r.soldToParty, 'Customer', {});
        edges.push({ source: r.soldToParty, target: r.salesOrder, type: 'PLACED_ORDER' });
      }
    }

    // Billing Documents
    const bd = db.prepare(`SELECT billingDocument, accountingDocument, soldToParty, totalNetAmount, billingDocumentIsCancelled FROM billing_document_headers LIMIT 200`).all();
    for (const r of bd) {
      addNode(r.billingDocument, 'BillingDoc', { amount: r.totalNetAmount, cancelled: r.billingDocumentIsCancelled });
    }

    // Billing Items → link billing to sales order
    const bdi = db.prepare(`SELECT billingDocument, salesDocument FROM billing_document_items WHERE salesDocument IS NOT NULL AND salesDocument != '' LIMIT 300`).all();
    for (const r of bdi) {
      if (nodeSet.has(r.salesDocument) && nodeSet.has(r.billingDocument)) {
        edges.push({ source: r.salesDocument, target: r.billingDocument, type: 'BILLED_AS' });
      }
    }

    // Journal Entries → link to billing
    const je = db.prepare(`SELECT accountingDocument, referenceDocument FROM journal_entry_items LIMIT 200`).all();
    for (const r of je) {
      addNode(r.accountingDocument, 'JournalEntry', {});
      if (r.referenceDocument && nodeSet.has(r.referenceDocument)) {
        edges.push({ source: r.referenceDocument, target: r.accountingDocument, type: 'HAS_JOURNAL' });
      }
    }

    // Link billing to journal via accountingDocument
    for (const r of bd) {
      if (r.accountingDocument && nodeSet.has(r.accountingDocument)) {
        edges.push({ source: r.billingDocument, target: r.accountingDocument, type: 'ACCOUNTING' });
      }
    }

    // Deliveries
    const del = db.prepare(`SELECT deliveryDocument, soldToParty, overallDeliveryStatus FROM outbound_delivery_headers LIMIT 150`).all();
    for (const r of del) {
      addNode(r.deliveryDocument, 'Delivery', { status: r.overallDeliveryStatus });
    }

    // Delivery Items → link to sales order
    const deli = db.prepare(`SELECT deliveryDocument, referenceSDDocument FROM outbound_delivery_items WHERE referenceSDDocument IS NOT NULL AND referenceSDDocument != '' LIMIT 200`).all();
    for (const r of deli) {
      if (nodeSet.has(r.referenceSDDocument) && nodeSet.has(r.deliveryDocument)) {
        edges.push({ source: r.referenceSDDocument, target: r.deliveryDocument, type: 'DELIVERED_BY' });
      }
    }

    // Payments
    const pay = db.prepare(`SELECT accountingDocument, customer, amountInTransactionCurrency FROM payments_ar LIMIT 100`).all();
    for (const r of pay) {
      addNode(`PAY-${r.accountingDocument}`, 'Payment', { amount: r.amountInTransactionCurrency });
      if (r.accountingDocument && nodeSet.has(r.accountingDocument)) {
        edges.push({ source: r.accountingDocument, target: `PAY-${r.accountingDocument}`, type: 'PAYMENT' });
      }
    }

    // Deduplicate edges
    const edgeSet = new Set();
    const uniqueEdges = edges.filter(e => {
      const key = `${e.source}::${e.target}::${e.type}`;
      if (edgeSet.has(key)) return false;
      edgeSet.add(key);
      return true;
    });

    res.json({ nodes, edges: uniqueEdges });
  } catch (error) {
    console.error('Graph error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Chat / Query Endpoint ────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const result = await processQuery(message);
    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      answer: `Error processing query: ${error.message}`,
      sql: '',
      data: []
    });
  }
});

// ─── Node Detail Endpoint ─────────────────────────────────────────────────────
app.get('/api/node/:type/:id', (req, res) => {
  const { type, id } = req.params;
  try {
    let data = null;
    let connections = 0;

    switch (type) {
      case 'SalesOrder':
        data = db.prepare(`SELECT * FROM sales_order_headers WHERE salesOrder = ?`).get(id);
        connections = db.prepare(`SELECT COUNT(*) as c FROM billing_document_items WHERE salesDocument = ?`).get(id)?.c || 0;
        break;
      case 'BillingDoc':
        data = db.prepare(`SELECT * FROM billing_document_headers WHERE billingDocument = ?`).get(id);
        connections = db.prepare(`SELECT COUNT(*) as c FROM billing_document_items WHERE billingDocument = ?`).get(id)?.c || 0;
        break;
      case 'JournalEntry':
        data = db.prepare(`SELECT * FROM journal_entry_items WHERE accountingDocument = ?`).get(id);
        connections = 2;
        break;
      case 'Delivery':
        data = db.prepare(`SELECT * FROM outbound_delivery_headers WHERE deliveryDocument = ?`).get(id);
        connections = db.prepare(`SELECT COUNT(*) as c FROM outbound_delivery_items WHERE deliveryDocument = ?`).get(id)?.c || 0;
        break;
      case 'Customer':
        data = db.prepare(`SELECT * FROM business_partners WHERE businessPartner = ?`).get(id);
        connections = db.prepare(`SELECT COUNT(*) as c FROM sales_order_headers WHERE soldToParty = ?`).get(id)?.c || 0;
        break;
      case 'Payment':
        const realId = id.replace('PAY-', '');
        data = db.prepare(`SELECT * FROM payments_ar WHERE accountingDocument = ?`).get(realId);
        connections = 1;
        break;
      default:
        data = {};
    }

    res.json({ type, id, data: data || {}, connections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const counts = {
    sales_orders: db.prepare(`SELECT COUNT(*) as c FROM sales_order_headers`).get()?.c,
    billing_docs: db.prepare(`SELECT COUNT(*) as c FROM billing_document_headers`).get()?.c,
    journal_entries: db.prepare(`SELECT COUNT(*) as c FROM journal_entry_items`).get()?.c,
    deliveries: db.prepare(`SELECT COUNT(*) as c FROM outbound_delivery_headers`).get()?.c,
    payments: db.prepare(`SELECT COUNT(*) as c FROM payments_ar`).get()?.c,
  };
  res.json({ status: 'ok', counts });
});

app.listen(PORT, () => {
  console.log(`\n🚀 InsightFlow AI Backend running on http://localhost:${PORT}`);
  console.log(`   Graph:  GET  /api/graph`);
  console.log(`   Chat:   POST /api/chat`);
  console.log(`   Health: GET  /api/health\n`);
});
