// index.js — the whole MVP backend in one file. Run: node server/index.js
require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const { answerQuestion, addKnowledge } = require("./rag");
const { recordUsageAndMaybeBill } = require("./billing");

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- The core money-making endpoint ---
app.post("/ask", async (req, res) => {
  try {
    const { userId, question } = req.body;
    if (!userId || !question) {
      return res.status(400).json({ error: "userId and question are required" });
    }

    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (rows.length === 0) return res.status(404).json({ error: "unknown user" });
    const user = rows[0];

    const { answer, costUsd } = await answerQuestion(pool, question);
    const billing = await recordUsageAndMaybeBill(pool, user, question, answer, costUsd);

    res.json({ answer, billing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "something went wrong" });
  }
});

// --- Admin endpoint to seed your knowledge base ---
app.post("/knowledge", async (req, res) => {
  const { content } = req.body;
  await addKnowledge(pool, content);
  res.json({ status: "added" });
});

// --- Quick signup (swap for real auth later) ---
app.post("/signup", async (req, res) => {
  const { id, email } = req.body;
  await pool.query(
    "INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [id, email]
  );
  res.json({ status: "created" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MVP running on port ${PORT}`));
