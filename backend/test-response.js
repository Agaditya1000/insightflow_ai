require('dotenv').config();
const axios = require('axios');

async function test() {
  const r = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'google/gemma-3-4b-it:free',
      messages: [
        { role: 'user', content: 'User question: "List products with descriptions"\n\nGenerate a SQLite SQL query and return results in JSON format: {"answer": "natural language answer", "sql": "the SQL query", "data": []}. Return ONLY valid JSON, no markdown, no explanation outside the JSON.' }
      ],
      max_tokens: 512,
      temperature: 0.1
    },
    { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:5173' } }
  );
  console.log('RAW RESPONSE:');
  console.log(r.data.choices[0].message.content);
}
test().catch(e => console.error(e.response?.data || e.message));
