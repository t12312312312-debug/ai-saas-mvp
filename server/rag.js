// rag.js — turns a question into a search over your knowledge base.
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Turn text into a list of numbers (an "embedding") that captures its meaning.
async function embed(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // cheap + fast; upgrade per-query later if needed
    messages: [{ role: "user", content: prompt }],
  });

  const answer = completion.choices[0].message.content;
  // Rough cost estimate — refine with actual token counts from the response.
  const costUsd = (completion.usage.total_tokens / 1_000_000) * 0.15;
  return { answer, costUsd };
}

module.exports = { embed, addKnowledge, retrieve, answerQuestion };
