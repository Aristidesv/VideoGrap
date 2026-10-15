import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to start the API server.");
}

export const pool = new Pool({
  connectionString,
  options: "-c search_path=vidgrab,public",
  ssl: process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: true }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

export async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS vidgrab");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrations = [
      { version: "001_initial", file: "schema.sql" },
      { version: "002_account_security", file: "002_account_security.sql" },
      { version: "003_analysis_history_and_temporary_downloads", file: "003_analysis_history_and_temporary_downloads.sql" },
      { version: "004_premium_payments", file: "004_premium_payments.sql" },
    ];

    for (const migration of migrations) {
      const applied = await client.query<{ version: string }>(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [migration.version],
      );
      if (applied.rowCount) continue;

      const sql = await readFile(
        path.resolve(process.cwd(), "server", migration.file),
        "utf8",
      );
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [migration.version],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
