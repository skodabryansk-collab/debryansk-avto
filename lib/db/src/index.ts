import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Prevent uncaught 'error' event on idle connections from crashing the process.
// pg-pool emits this when the DB server closes an idle connection (e.g. during
// a brief outage). Without this handler Node.js treats it as an unhandled
// exception and kills the process, triggering a crash loop.
pool.on("error", (err) => {
  console.error("[pg-pool] idle client error (non-fatal):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
