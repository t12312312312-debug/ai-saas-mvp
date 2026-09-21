# AI Answer MVP — Setup Guide

## What this is
A minimal, working "ask a question, get an AI answer grounded in your own knowledge, get billed for it" backend. This is the smallest version of the platform that can make money.

## Setup (15 minutes)

1. **Get a Postgres database** with the pgvector extension. Easiest: [Supabase](https://supabase.com) free tier already has it enabled.
2. **Run the schema:**
   ```
   psql $DATABASE_URL -f schema.sql
   ```
3. **Get API keys:**
   - OpenAI: platform.openai.com → API keys
   - Stripe: dashboard.stripe.com → Developers → API keys, plus set up a metered price for "answer_given" under Products
4. **Create a `.env` file:**
   ```
   DATABASE_URL=postgres://...
   OPENAI_API_KEY=sk-...
   STRIPE_SECRET_KEY=sk_...
   ```
5. **Install and run:**
   ```
   npm install
   npm start
   ```
6. **Seed some knowledge** (do this for every doc/fact you want the AI to know):
   ```
   curl -X POST http://localhost:3000/knowledge \
     -H "Content-Type: application/json" \
     -d '{"content": "Your knowledge text here"}'
   ```
7. **Create a test user:**
   ```
   curl -X POST http://localhost:3000/signup \
     -H "Content-Type: application/json" \
     -d '{"id": "demo-user", "email": "you@example.com"}'
   ```
8. **Open `frontend.html`** in your browser and start asking questions.

## How the profit mechanics work
- First 20 answers per user per month: free (drives activation, costs you ~$0.01-0.20 total)
- After that: every answer is metered and billed at $0.03, while actually costing you roughly $0.001-0.01 in OpenAI fees — a 3-30x margin depending on question length
- `usage_events` table is your source of truth — cross-check it against Stripe's dashboard weekly to catch billing drift early

## What's deliberately left out of this MVP (add only when you feel real pain)
- Multi-tenant isolation beyond a `user_id` column — fine until you have enterprise customers demanding hard isolation
- Agent orchestration frameworks (Temporal, LangGraph) — this is a single LLM call, no multi-step agent needed yet
- A dedicated vector DB — pgvector handles thousands of chunks fine
- Real auth — swap the `/signup` endpoint for Clerk/Auth0 when you have real users

## Next step once this works
Get 10 real people asking real questions through this before building anything else. Their questions tell you what knowledge to add, and their willingness to hit the paywall tells you if $0.03/answer is priced right.
