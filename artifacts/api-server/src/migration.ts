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

    // Add brand_ids array column to news (multi-brand support)
    await db.execute(sql`ALTER TABLE news ADD COLUMN IF NOT EXISTS brand_ids integer[] NOT NULL DEFAULT '{}'`);
    // Migrate existing brand_id → brand_ids (one-time, idempotent)
    await db.execute(sql`
      UPDATE news SET brand_ids = ARRAY[brand_id]
      WHERE brand_id IS NOT NULL AND (brand_ids IS NULL OR brand_ids = '{}')
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

    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS popularity_score integer NOT NULL DEFAULT 0`);

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

    // Individual reviews rows (replaces single-blob reviews_cache)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        author TEXT NOT NULL,
        rating INTEGER NOT NULL DEFAULT 5,
        text TEXT NOT NULL DEFAULT '',
        date DATE,
        source TEXT,
        source_url TEXT,
        synced_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviews_meta (
        id INTEGER PRIMARY KEY DEFAULT 1,
        overall_count INTEGER NOT NULL DEFAULT 0,
        last_sync_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT reviews_meta_single_row CHECK (id = 1)
      )
    `);
    logger.info("reviews + reviews_meta schema ready (idempotent)");

    // Brand slugs + brand_page_content table (Task #192)
    await db.execute(sql`ALTER TABLE brands ADD COLUMN IF NOT EXISTS slug TEXT`);

    // Enforce uniqueness on brands.slug (idempotent)
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug)
      WHERE slug IS NOT NULL
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS brand_page_content (
        id SERIAL PRIMARY KEY,
        brand_id INTEGER NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
        description TEXT,
        advantages JSONB DEFAULT '[]',
        features JSONB DEFAULT '[]',
        faq JSONB DEFAULT '[]',
        service_text TEXT,
        promo_text TEXT,
        external_url TEXT,
        hero_image_url TEXT,
        meta_title TEXT,
        meta_description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Backfill slugs for all brands (idempotent via WHERE slug IS NULL).
    // Ordered most-specific first to avoid ambiguous partial matches.
    await db.execute(sql`UPDATE brands SET slug = 'haval-city'    WHERE (LOWER(name) LIKE '%haval%city%' OR LOWER(name) = 'haval city') AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'haval-pro'     WHERE (LOWER(name) LIKE '%haval%pro%'  OR LOWER(name) = 'haval pro')  AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'mercedes-benz' WHERE (LOWER(name) LIKE '%mercedes%'   OR LOWER(name) LIKE '%benz%')  AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'mb-bryansk'    WHERE (LOWER(name) LIKE '%мб%брянск%'  OR LOWER(name) LIKE '%мб-%')   AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'volkswagen'    WHERE (LOWER(name) LIKE '%volkswagen%' OR LOWER(name) IN ('vw','volkswagen')) AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'omoda'         WHERE  LOWER(name) LIKE '%omoda%'      AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'jaecoo'        WHERE  LOWER(name) LIKE '%jaecoo%'     AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'tenet'         WHERE  LOWER(name) LIKE '%tenet%'      AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'jetour'        WHERE  LOWER(name) LIKE '%jetour%'     AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 's-probegom'    WHERE  LOWER(name) LIKE '%пробег%'     AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'haval'         WHERE  LOWER(name) = 'haval'            AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'skoda'         WHERE  LOWER(name) LIKE '%skoda%'      AND slug IS NULL`);
    await db.execute(sql`UPDATE brands SET slug = 'exeed'         WHERE  LOWER(name) LIKE '%exeed%'      AND slug IS NULL`);

    // Fallback: auto-generate slug for any remaining NULL brands using ASCII name
    // (covers future Latin-named brands added without explicit slug rules)
    await db.execute(sql`
      UPDATE brands
      SET slug = LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'),
          '(^-|-$)', '', 'g'
        )
      )
      WHERE slug IS NULL
        AND name ~ '^[a-zA-Z]'
        AND TRIM(LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')))
            NOT IN (SELECT slug FROM brands WHERE slug IS NOT NULL)
    `);

    // Log any brands that still have no slug after all rules (Cyrillic-only names without a rule)
    const nullSlugs = await db.execute(sql`SELECT id, name FROM brands WHERE slug IS NULL`);
    if (nullSlugs.rows.length) {
      logger.warn({ brands: nullSlugs.rows }, "brands.slug backfill: some brands still have NULL slug — add explicit rule");
    }

    // Seed template brand_page_content for all slugged brands without a row yet.
    // Includes description, service_text, meta_title, meta_description.
    await db.execute(sql`
      INSERT INTO brand_page_content (brand_id, description, service_text, meta_title, meta_description)
      SELECT b.id,
        'Официальный дилер ' || b.name || ' в Брянске — широкий выбор автомобилей, сервисное обслуживание и выгодные условия покупки в Дебрянск Авто.' AS description,
        'Сервисный центр ' || b.name || ' в Брянске: гарантийное и постгарантийное обслуживание, оригинальные запчасти, запись онлайн. Опытные мастера, современное оборудование.' AS service_text,
        b.name || ' в Брянске — официальный дилер Дебрянск Авто' AS meta_title,
        'Купить ' || b.name || ' в Брянске. Официальный дилер Дебрянск Авто: новые автомобили, трейд-ин, кредит, сервис.' AS meta_description
      FROM brands b
      WHERE b.slug IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM brand_page_content bpc WHERE bpc.brand_id = b.id)
    `);

    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS advantages JSONB DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS hero_image_url TEXT`);
    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS hero_image_mobile_url TEXT`);
    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS promotions JSONB DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS models JSONB DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE brand_page_content ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'`);

    // Global promotions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        image TEXT,
        badge TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        button_text TEXT,
        button_url TEXT,
        brand_ids INTEGER[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    logger.info("brands.slug + brand_page_content schema ready (idempotent)");

    // Migrate JSONB promotions from brand_page_content → global promotions table (idempotent)
    // Only process rows that still have non-empty promotions JSONB array
    const legacyPromoRows = await db.execute(sql`
      SELECT bpc.brand_id, bpc.promotions
      FROM brand_page_content bpc
      WHERE bpc.promotions IS NOT NULL
        AND jsonb_array_length(bpc.promotions) > 0
    `);

    if (legacyPromoRows.rows.length > 0) {
      logger.info({ count: legacyPromoRows.rows.length }, "Migrating legacy JSONB promotions to global promotions table");

      for (const row of legacyPromoRows.rows as { brand_id: number; promotions: Array<{
        title?: string; description?: string; image?: string; badge?: string;
        expiresAt?: string; buttonText?: string; buttonUrl?: string; isActive?: boolean;
      }> }[]) {
        const brandId = row.brand_id;
        const items = Array.isArray(row.promotions) ? row.promotions : [];

        for (const promo of items) {
          if (!promo.title) continue;

          // Idempotent: skip if a promotion with same title already exists for this brand
          const existing = await db.execute(sql`
            SELECT id FROM promotions
            WHERE title = ${promo.title}
              AND ${brandId} = ANY(brand_ids)
            LIMIT 1
          `);
          if (existing.rows.length > 0) continue;

          const expiresAt = promo.expiresAt ? new Date(promo.expiresAt) : null;

          await db.execute(sql`
            INSERT INTO promotions (title, description, image, badge, expires_at, is_active, button_text, button_url, brand_ids)
            VALUES (
              ${promo.title},
              ${promo.description ?? ""},
              ${promo.image ?? null},
              ${promo.badge ?? null},
              ${expiresAt},
              ${promo.isActive !== false},
              ${promo.buttonText ?? null},
              ${promo.buttonUrl ?? null},
              ${sql`ARRAY[${brandId}]::integer[]`}
            )
          `);
        }

        // Clear the JSONB field after migration
        await db.execute(sql`
          UPDATE brand_page_content
          SET promotions = '[]'::jsonb
          WHERE brand_id = ${brandId}
        `);
      }

      logger.info("Legacy JSONB promotions migration complete");
    } else {
      logger.info("No legacy JSONB promotions to migrate");
    }

    // ── car_mark column on brands ─────────────────────────────
    await db.execute(sql`ALTER TABLE brands ADD COLUMN IF NOT EXISTS car_mark TEXT`);

    // Seed known auto.ru mark → dealer brand mappings
    const carMarkSeed: Array<{ id: number; mark: string }> = [
      { id: 3, mark: "Haval" },   // Haval City
      { id: 4, mark: "Haval" },   // Haval Pro
      { id: 1, mark: "Omoda" },   // OMODA
      { id: 2, mark: "Jaecoo" },  // JAECOO
      { id: 6, mark: "Jetour" },  // Jetour
      { id: 57, mark: "Soueast" },// Soueast
      { id: 5, mark: "Tenet" },   // Tenet
      { id: 19, mark: "Exeed" },  // Exeed
      { id: 18, mark: "Skoda" },  // SKODA
      { id: 17, mark: "Volkswagen" }, // VW
      { id: 20, mark: "Mercedes-Benz" }, // Mercedes-Benz
    ];
    for (const { id, mark } of carMarkSeed) {
      await db.execute(sql`
        UPDATE brands SET car_mark = ${mark} WHERE id = ${id} AND car_mark IS NULL
      `);
    }
    logger.info("brands.car_mark: seeded");

    // ── Disclaimers tables ────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS disclaimers (
        id SERIAL PRIMARY KEY,
        scope TEXT NOT NULL,
        brand_id INTEGER,
        model TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS disclaimer_versions (
        id SERIAL PRIMARY KEY,
        disclaimer_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promotion_disclaimers (
        promotion_id INTEGER NOT NULL,
        disclaimer_id INTEGER NOT NULL,
        PRIMARY KEY (promotion_id, disclaimer_id)
      )
    `);

    // Seed system disclaimer for used-car pricing (scope='price_from_used')
    const existingUsed = await db.execute(sql`
      SELECT id FROM disclaimers WHERE scope = 'price_from_used' LIMIT 1
    `);
    if (!existingUsed.rows[0]) {
      await db.execute(sql`
        INSERT INTO disclaimers (scope, brand_id, model, title, content, is_active)
        VALUES ('price_from_used', NULL, NULL, 'Информация о цене',
          'Цена указана для базовой комплектации и может отличаться в зависимости от технического состояния, пробега и комплектации конкретного автомобиля. Точную стоимость уточняйте у менеджера.',
          TRUE
        )
      `);
      logger.info("disclaimers: seeded price_from_used system record");
    }

  } catch (err) {
    logger.error({ err }, "Migration error");
  }
}
