import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      input_text TEXT NOT NULL,
      extracted JSONB NOT NULL,
      flags JSONB NOT NULL
    )
  `);
}

export async function saveSubmission(
  inputText: string,
  extracted: object,
  flags: object[]
) {
  const result = await pool.query(
    `INSERT INTO submissions (input_text, extracted, flags) VALUES ($1, $2, $3) RETURNING *`,
    [inputText, JSON.stringify(extracted), JSON.stringify(flags)]
  );
  return result.rows[0];
}

export async function getSubmissions(limit = 20) {
  const result = await pool.query(
    `SELECT id, created_at, extracted, flags FROM submissions ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
