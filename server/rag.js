// rag.js — turns a question into a search over your knowledge base.
// Uses Google Gemini's free API (no credit card needed) instead of OpenAI.
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`;
const CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

// Turn text into a list of numbers (an "embedding") that captures its meaning.
async function embed(text) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  const data = await res.json();
  if (!data.embedding) {
    throw new Error("Embedding failed: " + JSON.stringify(data));
  }
  return data.embedding.values; // 768 numbers
}

// Add a piece of knowledge to the database (run this once per document/chunk).
async function addKnowledge(pool, content) {
  const vector = await embed(content);
  await pool.query(
    "INSERT INTO knowledge_chunks (content, embedding) VALUES ($1, $2)",
    [content, JSON.stringify(vector)]
  );
}

// Given a question, find the most relevant notes (top 5) via cosine similarity.
async function retrieve(pool, question, topK = 5) {
  const vector = await embed(question);
  const { rows } = await pool.query(
    `SELECT content FROM knowledge_chunks
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(vector), topK]
  );
  return rows.map((r) => r.content);
}

// Ask the AI, giving it the retrieved notes as grounding context.
async function answerQuestion(pool, question) {
  const context = await retrieve(pool, question);
  const prompt = `Answer the question using ONLY the context below. If the context doesn't contain the answer, say you don't know.

Context:
${context.join("\n---\n")}

Question: ${question}`;

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text
    || "Sorry, I couldn't generate an answer.";

  const costUsd = 0; // Gemini free tier costs nothing
  return { answer, costUsd };
}

module.exports = { embed, addKnowledge, retrieve, answerQuestion };
