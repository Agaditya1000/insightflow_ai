require('dotenv').config();
const axios = require('axios');

const MODELS_TO_TRY = [
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'google/gemma-3-4b-it:free',
  'deepseek/deepseek-r1-distill-qwen-7b:free',
];

async function testModel(model) {
  try {
    const r = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model, messages: [{ role: 'user', content: 'Say "ok" only.' }], max_tokens: 5 },
      { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:5173' } }
    );
    console.log(`✓ ${model}: ${r.data.choices[0].message.content}`);
    return true;
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.response?.data?.message || e.message;
    console.log(`✗ ${model}: ${msg}`);
    return false;
  }
}

async function main() {
  console.log('Testing OpenRouter models...\nKey:', process.env.OPENROUTER_API_KEY?.substring(0, 15) + '...\n');
  for (const m of MODELS_TO_TRY) {
    const ok = await testModel(m);
    if (ok) { console.log('\n✅ Use this model:', m); break; }
  }
}
main();
