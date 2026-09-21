// billing.js — records usage and reports it to Stripe as a metered event.
const crypto = require("crypto");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FREE_ANSWERS_PER_MONTH = 20;
const PRICE_PER_ANSWER_USD = 0.03; // your margin vs ~$0.001-0.01 actual API cost

// Deterministic key so a retried request never gets billed twice.
function makeIdempotencyKey(userId, question, timestamp) {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${question}:${timestamp}`)
    .digest("hex");
}

async function recordUsageAndMaybeBill(pool, user, question, answer, costUsd) {
  const idempotencyKey = makeIdempotencyKey(user.id, question, Date.now());

  // Store the event first — this is your source of truth, independent of Stripe.
  await pool.query(
    `INSERT INTO usage_events (user_id, idempotency_key, question, answer, cost_usd)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [user.id, idempotencyKey, question, answer, costUsd]
  );

  // Free tier: don't bill, just count.
  if (user.free_answers_used < FREE_ANSWERS_PER_MONTH) {
    await pool.query(
      "UPDATE users SET free_answers_used = free_answers_used + 1 WHERE id = $1",
      [user.id]
    );
    return { billed: false };
  }

  // Paid: report one metered unit to Stripe. Stripe's own idempotency key
  // header prevents double-reporting on network retries.
  if (user.stripe_customer_id) {
    await stripe.billing.meterEvents.create(
      {
        event_name: "answer_given",
        payload: { stripe_customer_id: user.stripe_customer_id, value: "1" },
      },
      { idempotencyKey }
    );
  }

  return { billed: true, priceUsd: PRICE_PER_ANSWER_USD };
}

module.exports = { recordUsageAndMaybeBill, FREE_ANSWERS_PER_MONTH };
