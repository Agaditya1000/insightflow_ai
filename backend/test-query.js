require('dotenv').config();
const { processQuery } = require('./query');

async function test() {
  console.log('Testing LLM path with Gemma...\n');
  const r = await processQuery('What plants are in the database?');
  console.log('Answer:', r.answer?.substring(0, 200));
  console.log('SQL:', r.sql);
  console.log('Data rows:', r.data?.length);
}
test().catch(console.error);
