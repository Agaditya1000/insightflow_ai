require('dotenv').config();
const axios = require('axios');
const db = require('./db');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Ordered list of models to try — free first, then low-cost paid as fallbacks
const FREE_MODELS = [
  'google/gemma-3-4b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
  'openai/gpt-4o-mini',
  'anthropic/claude-3-haiku',
];

// Database schema summary for the LLM
const SCHEMA_SUMMARY = `
You are an intelligent SAP Order-to-Cash (O2C) data analyst assistant called "Dodge AI".
You have access to a SQLite database with the following tables:

1. sales_order_headers(salesOrder, soldToParty, creationDate, totalNetAmount, overallDeliveryStatus, transactionCurrency, customerPaymentTerms, ...)
2. sales_order_items(salesOrder, salesOrderItem, material, requestedQuantity, netAmount, ...)
3. billing_document_headers(billingDocument, billingDocumentType, accountingDocument, soldToParty, totalNetAmount, billingDocumentIsCancelled, cancelledBillingDocument, ...)
4. billing_document_items(billingDocument, billingDocumentItem, material, salesDocument, referenceSDDocument, ...)
5. journal_entry_items(accountingDocument, referenceDocument, glAccount, amountInTransactionCurrency, postingDate, customer, clearingAccountingDocument, ...)
   NOTE: journal_entry_items.referenceDocument = billing document number
   NOTE: billing_document_headers.accountingDocument = journal_entry_items.accountingDocument
6. outbound_delivery_headers(deliveryDocument, soldToParty, deliveryDate, overallDeliveryStatus, ...)
7. outbound_delivery_items(deliveryDocument, referenceSDDocument[=salesOrder], materialDocument, ...)
8. payments_ar(accountingDocument, customer, amountInTransactionCurrency, postingDate, ...)
9. business_partners(businessPartner, businessPartnerFullName, businessPartnerFirstName, businessPartnerLastName, ...)
10. products(product, baseUnit, grossWeight, materialGroup, ...)
11. product_descriptions(product, language, productDescription)
12. plants(plant, plantName, companyCode, cityName, country)

KEY RELATIONSHIPS:
- SalesOrder → BillingDoc: via billing_document_items.salesDocument = sales_order_headers.salesOrder
- BillingDoc → JournalEntry: billing_document_headers.accountingDocument = journal_entry_items.accountingDocument
- JournalEntry.referenceDocument = billingDocument number
- SalesOrder → Delivery: outbound_delivery_items.referenceSDDocument = sales_order_headers.salesOrder
- Customer = soldToParty = business_partners.businessPartner

RULES:
- ONLY answer questions about this O2C dataset
- If the question is unrelated, return: {"answer": "This system is designed to answer questions related to the provided dataset only.", "sql": "", "data": []}
- Always return valid JSON in this exact format: {"answer": "...", "sql": "...", "data": [...]}
- For the 'data' array, include the actual query results (max 20 rows)
- Format the answer naturally with key facts
`;

function runQuery(sql) {
  try {
    if (!sql || sql.trim() === '') return { results: [], error: null };
    const stmt = db.prepare(sql);
    const results = stmt.all();
    return { results, error: null };
  } catch (e) {
    return { results: [], error: e.message };
  }
}

// Pattern-based fast-path for known queries (avoids LLM for simple lookups)
function tryPatternMatch(message) {
  const msg = message.toLowerCase();
  const nums = message.match(/\d{7,}/g) || [];

  // Journal entry linked to billing doc
  if ((msg.includes('journal') || msg.includes('accounting')) && (msg.includes('billing') || msg.includes('linked')) && nums.length > 0) {
    for (const num of nums) {
      // Try as billing document
      const r1 = db.prepare(`
        SELECT j.accountingDocument, j.referenceDocument, j.glAccount, j.amountInTransactionCurrency,
               j.transactionCurrency, j.postingDate, j.accountingDocumentType, j.companyCode, j.fiscalYear,
               b.billingDocument, b.billingDocumentType, b.totalNetAmount
        FROM billing_document_headers b
        JOIN journal_entry_items j ON b.accountingDocument = j.accountingDocument
        WHERE b.billingDocument = ?
        LIMIT 5
      `).all(num);
      if (r1.length > 0) {
        const row = r1[0];
        return {
          answer: `The journal entry (Accounting Document) linked to billing document **${num}** is **${row.accountingDocument}**.\n\n- GL Account: ${row.glAccount}\n- Amount: ${row.amountInTransactionCurrency} ${row.transactionCurrency}\n- Posting Date: ${row.postingDate ? row.postingDate.split('T')[0] : 'N/A'}\n- Doc Type: ${row.accountingDocumentType}\n- Fiscal Year: ${row.fiscalYear}\n- Company Code: ${row.companyCode}`,
          sql: `SELECT j.accountingDocument, j.glAccount, j.amountInTransactionCurrency FROM billing_document_headers b JOIN journal_entry_items j ON b.accountingDocument = j.accountingDocument WHERE b.billingDocument = '${num}'`,
          data: r1
        };
      }
      // Try as accounting document
      const r2 = db.prepare(`SELECT * FROM journal_entry_items WHERE accountingDocument = ? LIMIT 5`).all(num);
      if (r2.length > 0) {
        return {
          answer: `Journal entry **${num}** links to billing document **${r2[0].referenceDocument}**.\n\n- GL Account: ${r2[0].glAccount}\n- Amount: ${r2[0].amountInTransactionCurrency} ${r2[0].transactionCurrency}\n- Posting Date: ${r2[0].postingDate ? r2[0].postingDate.split('T')[0] : 'N/A'}`,
          sql: `SELECT * FROM journal_entry_items WHERE accountingDocument = '${num}'`,
          data: r2
        };
      }
    }
  }

  // Sales order status / details
  if ((msg.includes('sales order') || msg.includes('order')) && nums.length > 0) {
    for (const num of nums) {
      const r = db.prepare(`SELECT * FROM sales_order_headers WHERE salesOrder = ?`).get(num);
      if (r) {
        return {
          answer: `Sales Order **${num}**:\n- Customer: ${r.soldToParty}\n- Amount: ${r.totalNetAmount} ${r.transactionCurrency}\n- Created: ${r.creationDate ? r.creationDate.split('T')[0] : 'N/A'}\n- Delivery Status: ${r.overallDeliveryStatus || 'N/A'}\n- Payment Terms: ${r.customerPaymentTerms || 'N/A'}`,
          sql: `SELECT * FROM sales_order_headers WHERE salesOrder = '${num}'`,
          data: [r]
        };
      }
    }
  }

  // Delivery linked to billing
  if ((msg.includes('deliver') && nums.length > 0)) {
    for (const num of nums) {
      const r = db.prepare(`SELECT * FROM outbound_delivery_headers WHERE deliveryDocument = ?`).get(num);
      if (r) {
        return {
          answer: `Delivery **${num}**:\n- Customer: ${r.soldToParty}\n- Delivery Date: ${r.deliveryDate ? r.deliveryDate.split('T')[0] : 'N/A'}\n- Status: ${r.overallDeliveryStatus || 'N/A'}`,
          sql: `SELECT * FROM outbound_delivery_headers WHERE deliveryDocument = '${num}'`,
          data: [r]
        };
      }
    }
  }

  // Cancelled billings
  if (msg.includes('cancel') && (msg.includes('billing') || msg.includes('invoice'))) {
    const r = db.prepare(`SELECT COUNT(*) as count FROM billing_document_headers WHERE billingDocumentIsCancelled = 1`).get();
    const top = db.prepare(`SELECT billingDocument, totalNetAmount, billingDocumentDate FROM billing_document_headers WHERE billingDocumentIsCancelled = 1 LIMIT 10`).all();
    return {
      answer: `There are **${r.count}** cancelled billing documents in the dataset.`,
      sql: `SELECT COUNT(*) as count FROM billing_document_headers WHERE billingDocumentIsCancelled = 1`,
      data: top
    };
  }

  // Orders delivered but not billed
  if ((msg.includes('delivered') && msg.includes('not billed')) || (msg.includes('deliver') && msg.includes('unbilled'))) {
    const rows = db.prepare(`
      SELECT DISTINCT soh.salesOrder, soh.soldToParty, soh.totalNetAmount, soh.overallDeliveryStatus
      FROM sales_order_headers soh
      WHERE soh.overallDeliveryStatus = 'C'
        AND soh.salesOrder NOT IN (SELECT DISTINCT salesDocument FROM billing_document_items WHERE salesDocument IS NOT NULL AND salesDocument != '')
      LIMIT 20
    `).all();
    return {
      answer: `Found **${rows.length}** orders that are fully delivered but have no billing document linked.`,
      sql: `SELECT soh.salesOrder, soh.soldToParty, soh.totalNetAmount FROM sales_order_headers soh WHERE soh.overallDeliveryStatus = 'C' AND soh.salesOrder NOT IN (SELECT salesDocument FROM billing_document_items WHERE salesDocument != '') LIMIT 20`,
      data: rows
    };
  }

  // Top customers
  if (msg.includes('top') && (msg.includes('customer') || msg.includes('partner'))) {
    const rows = db.prepare(`
      SELECT soldToParty, COUNT(*) as orderCount, SUM(CAST(totalNetAmount AS REAL)) as totalAmount
      FROM sales_order_headers
      GROUP BY soldToParty
      ORDER BY totalAmount DESC
      LIMIT 10
    `).all();
    return {
      answer: `Top customers by total order amount:\n${rows.map((r, i) => `${i+1}. Customer **${r.soldToParty}** — ${r.orderCount} orders, ₹${r.totalAmount?.toFixed(2)}`).join('\n')}`,
      sql: `SELECT soldToParty, COUNT(*) as orderCount, SUM(CAST(totalNetAmount AS REAL)) as totalAmount FROM sales_order_headers GROUP BY soldToParty ORDER BY totalAmount DESC LIMIT 10`,
      data: rows
    };
  }

  // Total revenue
  if ((msg.includes('total') || msg.includes('sum')) && (msg.includes('revenue') || msg.includes('amount') || msg.includes('billing'))) {
    const r = db.prepare(`SELECT SUM(CAST(totalNetAmount AS REAL)) as total, COUNT(*) as count FROM billing_document_headers WHERE billingDocumentIsCancelled = 0`).get();
    return {
      answer: `Total billed revenue (non-cancelled): **₹${r.total?.toFixed(2)}** across **${r.count}** billing documents.`,
      sql: `SELECT SUM(CAST(totalNetAmount AS REAL)) as total, COUNT(*) as count FROM billing_document_headers WHERE billingDocumentIsCancelled = 0`,
      data: [r]
    };
  }

  // Count queries
  if (msg.includes('how many') || msg.includes('count') || msg.includes('total number') || (msg.includes('total') && !msg.includes('amount') && !msg.includes('revenue'))) {
    if (msg.includes('order')) {
      const r = db.prepare(`SELECT COUNT(*) as count FROM sales_order_headers`).get();
      return { answer: `There are **${r.count}** sales orders in the dataset.`, sql: `SELECT COUNT(*) FROM sales_order_headers`, data: [r] };
    }
    if (msg.includes('billing') || msg.includes('invoice')) {
      const r = db.prepare(`SELECT COUNT(*) as count FROM billing_document_headers`).get();
      return { answer: `There are **${r.count}** billing documents in the dataset.`, sql: `SELECT COUNT(*) FROM billing_document_headers`, data: [r] };
    }
    if (msg.includes('customer') || msg.includes('partner')) {
      const r = db.prepare(`SELECT COUNT(DISTINCT businessPartner) as count FROM business_partners`).get();
      return { answer: `There are **${r.count}** business partners/customers in the dataset.`, sql: `SELECT COUNT(DISTINCT businessPartner) FROM business_partners`, data: [r] };
    }
    if (msg.includes('deliver')) {
      const r = db.prepare(`SELECT COUNT(*) as count FROM outbound_delivery_headers`).get();
      return { answer: `There are **${r.count}** outbound deliveries in the dataset.`, sql: `SELECT COUNT(*) FROM outbound_delivery_headers`, data: [r] };
    }
    if (msg.includes('product')) {
      const r = db.prepare(`SELECT COUNT(*) as count FROM products`).get();
      return { answer: `There are **${r.count}** products in the dataset.`, sql: `SELECT COUNT(*) FROM products`, data: [r] };
    }
  }

  return null;
}

async function callOneModel(model, message) {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        { role: 'system', content: SCHEMA_SUMMARY },
        { role: 'user', content: `User question: "${message}"\n\nGenerate a SQLite SQL query for this question and return results in JSON format: {"answer": "natural language answer with key facts", "sql": "the SQL query", "data": []}. Return ONLY valid JSON. No explanation outside the JSON.` }
      ],
      max_tokens: 1024,
      temperature: 0.1
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'InsightFlow AI'
      }
    }
  );

  const content = response.data.choices[0].message.content.trim();
  
  // Check for provider-level errors in the response body
  if (response.data.error) {
    throw new Error(response.data.error.message || 'Provider error');
  }
  
  // Extract JSON - try multiple patterns
  let raw = null;
  const codeBlock = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) raw = codeBlock[1].trim();
  if (!raw) {
    const jsonBlock = content.match(/(\{[\s\S]*\})/);
    if (jsonBlock) raw = jsonBlock[1].trim();
  }
  if (!raw) raw = content;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { answer: content.replace(/```[\s\S]*?```/g, '').trim(), sql: '', data: [] };
  }

  // Execute the generated SQL against the real DB
  if (parsed.sql && parsed.sql.trim()) {
    const { results, error } = runQuery(parsed.sql);
    if (!error && results.length > 0) {
      parsed.data = results.slice(0, 20);
    } else if (error) {
      console.warn(`SQL error (${model}):`, error);
    }
  }

  return parsed;
}

async function callOpenRouter(message) {
  let lastError = null;
  for (const model of FREE_MODELS) {
    try {
      console.log(`Trying model: ${model}`);
      const result = await callOneModel(model, message);
      console.log(`✓ Success with: ${model}`);
      return result;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
      console.warn(`✗ ${model} failed: ${errMsg}`);
      lastError = errMsg;
      // Continue to next model
    }
  }
  // All models failed
  throw new Error(`All models unavailable. Last error: ${lastError}`);
}


async function processQuery(message) {
  // First try pattern matching (fast path)
  const patternResult = tryPatternMatch(message);
  if (patternResult) return patternResult;

  // Fall back to OpenRouter LLM
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    return {
      answer: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in backend/.env',
      sql: '',
      data: []
    };
  }

  try {
    return await callOpenRouter(message);
  } catch {
    // All LLM models failed — return a graceful response instructing the user
    return {
      answer: `I couldn't process this query through the AI model right now (free models are temporarily busy). Try one of these pre-built queries instead:\n\n- **How many sales orders are there?**\n- **Show cancelled billing documents**\n- **Top customers by revenue**\n- **Orders delivered but not billed**\n\nOr include a specific document number like: *"91150187 - Find journal entry linked to this?"*`,
      sql: '',
      data: []
    };
  }
}

module.exports = { processQuery };
