import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

export async function runMigration() {
  try {
    // Check if migration is needed by checking published_at type
    const checkResult = await db.execute(sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'news' AND column_name = 'published_at'
    `);

    const currentType = (checkResult.rows[0] as { data_type?: string })?.data_type;

    // Check if dealers has is_service column
    const checkDealers = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'dealers' AND column_name = 'is_service'
    `);
    if (!checkDealers.rows[0]) {
      logger.info("Adding is_service column to dealers");
      await db.execute(sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS email TEXT`);
      await db.execute(sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT FALSE`);
      await db.execute(sql`ALTER TABLE dealers ADD COLUMN IF NOT EXISTS services TEXT[]`);
    }

    if (currentType === "text") {
      logger.info("Running migration: production schema mismatch detected");

      // Drop and recreate tables (they are empty, so safe)
      await db.execute(sql`DROP TABLE IF EXISTS news CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS dealers CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS leads CASCADE`);

      await db.execute(sql`
        CREATE TABLE news (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          excerpt TEXT,
          content TEXT,
          category TEXT DEFAULT 'Новости',
          image TEXT,
          slug TEXT NOT NULL UNIQUE,
          published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          read_time INTEGER DEFAULT 3,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          image_mobile TEXT
        )
      `);

      await db.execute(sql`
        CREATE TABLE dealers (
          id SERIAL PRIMARY KEY,
          address TEXT NOT NULL,
          short_name TEXT NOT NULL,
          phone TEXT,
          hours TEXT,
          brands TEXT[],
          photo_url TEXT,
          map_x REAL,
          map_y REAL,
          email TEXT,
          is_service BOOLEAN DEFAULT FALSE,
          services TEXT[]
        )
      `);

      await db.execute(sql`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          is_admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await db.execute(sql`
        CREATE TABLE leads (
          id SERIAL PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT,
          phone TEXT,
          email TEXT,
          message TEXT,
          car TEXT,
          extra_json JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      logger.info("Migration completed: tables recreated with correct schema");
    } else {
      logger.info("Migration not needed: schema is correct");
    }
    // Idempotently create locations + location_brands tables (safe to run on every boot)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        map_x REAL,
        map_y REAL,
        phone TEXT,
        hours TEXT,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // Add UNIQUE constraint on title if missing (for tables created without it)
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name='locations' AND constraint_type='UNIQUE'
            AND constraint_name='locations_title_key'
        ) THEN
          ALTER TABLE locations ADD CONSTRAINT locations_title_key UNIQUE (title);
        END IF;
      END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS location_brands (
        id SERIAL PRIMARY KEY,
        location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        is_service BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        UNIQUE(location_id, brand_id)
      )
    `);

    // Add is_service_only column to brands if missing
    await db.execute(sql`ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_service_only BOOLEAN DEFAULT FALSE`);

    logger.info("Locations schema ready (idempotent)");

    // Idempotently create site_settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      INSERT INTO site_settings (key, value)
      VALUES ('header_phone', '+7 (4832) 000-000')
      ON CONFLICT (key) DO NOTHING
    `);
    logger.info("site_settings schema ready (idempotent)");

    // Conversations + messages tables for Navigator chat history (Task #94)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE,
        title TEXT NOT NULL DEFAULT 'Чат',
        consented_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        car_ids TEXT,
        rating INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // Cars table for XML sync + richer chat context (Task #96)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cars (
        id SERIAL PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        year INTEGER,
        color TEXT,
        price INTEGER,
        mileage INTEGER DEFAULT 0,
        body_type TEXT,
        modification TEXT,
        complectation TEXT,
        extras TEXT,
        description TEXT,
        image_url TEXT,
        vin TEXT,
        dealer TEXT,
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS owners_number integer`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS max_discount integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS credit_discount integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS tradein_discount integer NOT NULL DEFAULT 0`);

    // Normalize brand names — CM.Expert feeds sometimes export marks in UPPERCASE.
    // Running these UPDATEs on every boot is safe (idempotent once rows are fixed).
    await db.execute(sql`UPDATE cars SET brand = 'Chery'      WHERE brand = 'CHERY'`);
    await db.execute(sql`UPDATE cars SET brand = 'Tenet'      WHERE brand = 'TENET'`);
    await db.execute(sql`UPDATE cars SET brand = 'Great Wall' WHERE brand = 'GREAT WALL'`);
    await db.execute(sql`UPDATE cars SET brand = 'Haval'      WHERE brand = 'HAVAL'`);
    await db.execute(sql`UPDATE cars SET brand = 'Jaecoo'     WHERE brand = 'JAECOO'`);
    await db.execute(sql`UPDATE cars SET brand = 'Jetour'     WHERE brand = 'JETOUR'`);
    await db.execute(sql`UPDATE cars SET brand = 'Omoda'      WHERE brand = 'OMODA'`);
    await db.execute(sql`UPDATE cars SET brand = 'Exeed'      WHERE brand = 'EXEED'`);
    await db.execute(sql`UPDATE cars SET brand = 'Tank'       WHERE brand = 'TANK'`);

    logger.info("Navigator schema ready (conversations, messages, cars — idempotent)");

    // Reviews persistent cache — survives server restarts / redeploys
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviews_cache (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '[]',
        avg FLOAT NOT NULL DEFAULT 5,
        total INTEGER NOT NULL DEFAULT 0,
        overall_count INTEGER NOT NULL DEFAULT 0,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT reviews_cache_single_row CHECK (id = 1)
      )
    `);
    logger.info("reviews_cache schema ready (idempotent)");

  } catch (err) {
    logger.error({ err }, "Migration error");
  }
}
