import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is missing!");
    process.exit(1);
  }

  console.log("🗄️ Connecting to PostgreSQL to run schema migrations...");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("amazonaws.com") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const client = await pool.connect();
    const schemaPath = path.resolve(process.cwd(), "src", "core", "storage", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");

    console.log("📦 Applying schema.sql DDL...");
    await client.query(sql);
    console.log("✅ Database schema migration successfully applied!");
    client.release();
  } catch (err) {
    console.error("❌ Database migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
