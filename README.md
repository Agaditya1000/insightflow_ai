# InsightFlow AI - SAP Order-to-Cash Analytics

InsightFlow AI is a full-stack, AI-powered analytics dashboard that transforms complex SAP Order-to-Cash (O2C) business processes into an interactive, conversational graph experience.

### 🌐 Live Demo
- **Frontend App:** [https://insightflow-ai-nine.vercel.app/](https://insightflow-ai-nine.vercel.app/)
- **Backend API:** [https://insightflow-ai-0li7.onrender.com/](https://insightflow-ai-0li7.onrender.com/)

---

## 🎯 Features

- **Interactive Force-Directed Graph:** Visualizes 6 core O2C entities (Sales Orders, Deliveries, Billing Docs, Journal Entries, Customers, and Payments) and the specific relationships between them.
- **AI Graph Agent (Dodge AI):** A conversational interface powered by OpenRouter LLMs that translates natural language questions into SQLite queries and returns data-backed answers contextually mapped to the graph.
- **Auto-Zoom & Highlight:** Querying the AI for specific orders or entities dynamically zooms the graph and highlights the relevant nodes.
- **Robust Multi-Model Fallback:** The query engine is designed with a multi-LLM fallback chain (`Gemma` → `Llama 3.2` → `Qwen` → `Phi-3` → `GPT-4o-mini`) to ensure high availability and responsiveness.

## 🛠️ Tech Stack

**Frontend Framework:** React + Vite
**Graph Visualization:** `react-force-graph-2d`
**Backend API:** Node.js + Express
**Database:** SQLite (`better-sqlite3`)
**AI / LLM Layer:** OpenRouter API

---

## 💻 Local Setup Instructions

If you wish to run InsightFlow AI locally, you'll need Node.js installed on your machine.

### 1. Clone the repository
```bash
git clone https://github.com/Agaditya1000/insightflow_ai.git
cd insightflow_ai
```

### 2. Backend Setup
The backend runs an Express server and houses the SQLite database (`o2c.db`).
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory and add your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_key_here
PORT=3001
```
Start the backend server:
```bash
node server.js
```

### 3. Frontend Setup
In a new terminal, navigate to the frontend directory:
```bash
cd frontend
npm install
```
Start the Vite development server:
```bash
npm run dev
```

Visit the local URL (usually `http://localhost:5173`) in your browser to start analyzing data!
