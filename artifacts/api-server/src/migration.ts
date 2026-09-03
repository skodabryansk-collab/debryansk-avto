import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

export async function runMigration() {
  try {
    // UTM attribution is optional so existing leads remain valid. The table
    // may be created below during the legacy schema repair, so guard the ALTERs.
    await db.execute(sql`
      DO $$ BEGIN
        IF to_regclass('public.leads') IS NOT NULL THEN
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term TEXT;
          ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
        END IF;
      END $$;
    `);

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
          utm_source TEXT,
          utm_medium TEXT,
          utm_campaign TEXT,
          utm_term TEXT,
          utm_content TEXT,
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
    // Add section_vacancies flag — marks news to show on /vacancies page
    await db.execute(sql`ALTER TABLE news ADD COLUMN IF NOT EXISTS section_vacancies boolean NOT NULL DEFAULT false`);
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
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS drive_type text`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS fuel_type text`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS cm_dms_car_id text`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_volume real`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_power integer`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_source text`);
    await db.execute(sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_enriched_at timestamptz`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS cars_engine_enrichment_idx ON cars (engine_enriched_at)`);

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

    // ── cm_to_brand_id column on brands ───────────────────────
    await db.execute(sql`ALTER TABLE brands ADD COLUMN IF NOT EXISTS cm_to_brand_id TEXT`);

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

    // TO catalog persistent store — single-row JSONB table (survives redeploys)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS to_catalog_store (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT to_catalog_store_single_row CHECK (id = 1)
      )
    `);
    logger.info("to_catalog_store schema ready (idempotent)");

    // SEO query snapshots — weekly Webmaster API position tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seo_query_snapshots (
        id SERIAL PRIMARY KEY,
        query_text TEXT NOT NULL,
        total_shows INTEGER NOT NULL,
        total_clicks INTEGER NOT NULL,
        avg_position REAL NOT NULL,
        snapshot_date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_query_snapshots_query_date
      ON seo_query_snapshots (query_text, snapshot_date)
    `);
    logger.info("seo_query_snapshots schema ready (idempotent)");

    // Calltouch call tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS calltouch_calls (
        id                    SERIAL PRIMARY KEY,
        call_id               TEXT NOT NULL UNIQUE,
        phone_number          TEXT,
        tracking_number       TEXT,
        source                TEXT,
        campaign              TEXT,
        landing_page          TEXT,
        status                TEXT NOT NULL DEFAULT 'started',
        duration_seconds      INTEGER,
        call_recording_url    TEXT,
        recording_stored_path TEXT,
        started_at            TIMESTAMPTZ,
        completed_at          TIMESTAMPTZ,
        created_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_calltouch_calls_call_id
      ON calltouch_calls (call_id)
    `);
    logger.info("calltouch_calls schema ready (idempotent)");

    // Calltouch callback submissions — persistent idempotency and diagnostics
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS calltouch_callbacks (
        id                    SERIAL PRIMARY KEY,
        submission_id         TEXT NOT NULL UNIQUE,
        lead_id               INTEGER,
        status                TEXT NOT NULL DEFAULT 'pending',
        attempts              INTEGER NOT NULL DEFAULT 1,
        http_status           INTEGER,
        calltouch_request_id  TEXT,
        error_message         TEXT,
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_calltouch_callbacks_lead_id
      ON calltouch_callbacks (lead_id)
    `);
    await db.execute(sql`
      ALTER TABLE calltouch_callbacks
      ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1
    `);
    logger.info("calltouch_callbacks schema ready (idempotent)");

    // Promotions: unique shareable slug (Task #260)
    await db.execute(sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS slug TEXT`);
    // Best-effort ASCII slug from title, always suffixed with id to guarantee uniqueness;
    // Cyrillic titles fall back to "promo-<id>" (admin can rename in the UI).
    await db.execute(sql`
      UPDATE promotions
      SET slug = (
        CASE
          WHEN LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) = ''
            THEN 'promo'
          ELSE LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
        END
      ) || '-' || id::text
      WHERE slug IS NULL
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_slug ON promotions(slug)
      WHERE slug IS NOT NULL
    `);
    logger.info("promotions.slug schema ready (idempotent)");

    // ── Managers: self-registration columns ──────────────────────────────────
    await db.execute(sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    await db.execute(sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS brands JSONB`);
    await db.execute(sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS registration_pending BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS temp_password TEXT`);
    logger.info("managers: self-registration columns ready (idempotent)");

    // ── Sales head managers: brand (text) → brands (jsonb array) ─────────────
    await db.execute(sql`ALTER TABLE sales_head_managers ADD COLUMN IF NOT EXISTS brands JSONB DEFAULT '[]'`);
    const shmBrandExists = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='sales_head_managers' AND column_name='brand'
    `);
    if (shmBrandExists.rows.length > 0) {
      await db.execute(sql`
        UPDATE sales_head_managers SET brands = json_build_array(brand)
        WHERE brands IS NULL OR brands = '[]'::jsonb
      `);
    }
    await db.execute(sql`ALTER TABLE sales_head_managers DROP COLUMN IF EXISTS brand`);
    logger.info("sales_head_managers: brand→brands migration ready (idempotent)");

    // ── Locations: email для маршрутизации заявок ─────────────────────────────
    await db.execute(sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS email TEXT`);
    logger.info("locations.email column ready (idempotent)");

    // ── Corporate page singleton content ──────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS corporate_page_content (
        id                    INTEGER PRIMARY KEY DEFAULT 1,
        hero_title            TEXT NOT NULL DEFAULT '',
        hero_subtitle         TEXT NOT NULL DEFAULT '',
        advantages            JSONB NOT NULL DEFAULT '[]',
        steps                 JSONB NOT NULL DEFAULT '[]',
        sales_manager_name    TEXT,
        sales_manager_phone   TEXT,
        sales_manager_email   TEXT,
        sales_manager_photo   TEXT,
        service_manager_name  TEXT,
        service_manager_phone TEXT,
        service_manager_email TEXT,
        service_manager_photo TEXT,
        updated_at            TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT corporate_page_content_single_row CHECK (id = 1)
      )
    `);
    const existingCorporate = await db.execute(sql`SELECT id FROM corporate_page_content WHERE id = 1 LIMIT 1`);
    if (!existingCorporate.rows[0]) {
      const advantages = JSON.stringify([
        {
          groupTitle: "Преимущества лизинга для бизнеса",
          items: [
            { title: "Деньги остаются в обороте", description: "Регулярный платёж с выгодным первоначальным взносом вместо разовой оплаты полной стоимости" },
            { title: "Экономия на налогах", description: "Лизинговые платежи относятся на расходы, уменьшая налогооблагаемую базу; налог на имущество не начисляется, так как автомобиль на балансе лизинговой компании" },
            { title: "Ускоренная амортизация", description: "Договор лизинга позволяет применять коэффициент ускоренной амортизации" },
            { title: "Обновление автопарка без потерь", description: "По окончании срока лизинга — новый автомобиль на новых условиях" },
          ],
        },
        {
          groupTitle: "Гибкие условия под ваш бизнес",
          items: [
            { title: "Гибкий график платежей", description: "Подстраивается под денежный поток вашей компании" },
            { title: "Trade-in для автопарка одной сделкой", description: "Обмен нескольких автомобилей на новые без необходимости продавать каждый отдельно" },
            { title: "Любой бренд из нашего каталога", description: "Лизинговая схема доступна на весь ассортимент группы, без привязки к одной марке" },
          ],
        },
        {
          groupTitle: "Почему через Дебрянск Авто",
          items: [
            { title: "Прямой доступ к ведущим лизинговым компаниям России", description: "Работаем с большинством топ-лизингодателей без посредников — предлагаем выбор условий, а не единственный вариант" },
            { title: "Специальные условия по программам лизинга", description: "Выгода закладывается уже на этапе сделки" },
            { title: "Отдельное сервисное обслуживание автопарка", description: "По предварительной записи — оперативно, без длительного ожидания в общей очереди" },
            { title: "Персональный менеджер по сервису", description: "Отдельно от менеджера по продажам, ведёт именно обслуживание вашего автопарка" },
          ],
        },
      ]);
      const steps = JSON.stringify([
        { title: "Оставляете заявку", description: "Указываете параметры: марки, количество авто, предпочтительная схема — покупка или лизинг" },
        { title: "Персональный менеджер подбирает условия", description: "Связывается с вами и подбирает условия у лизинговых партнёров" },
        { title: "Оформление сделки", description: "При необходимости — trade-in текущего автопарка в рамках той же сделки" },
        { title: "Сервисное обслуживание", description: "Дальнейшее обслуживание автопарка с закреплённым персональным менеджером" },
      ]);
      await db.execute(sql`
        INSERT INTO corporate_page_content (id, hero_title, hero_subtitle, advantages, steps)
        VALUES (1,
          'Автомобили для бизнеса',
          'Лизинг от ведущих лизинговых компаний России, выгодные условия и отдельное сервисное обслуживание для корпоративных клиентов',
          ${advantages}::jsonb,
          ${steps}::jsonb
        )
      `);
      logger.info("corporate_page_content: seeded default content");
    }
    // Add role columns if they don't exist yet (idempotent)
    await db.execute(sql`ALTER TABLE corporate_page_content ADD COLUMN IF NOT EXISTS sales_manager_role TEXT`);
    await db.execute(sql`ALTER TABLE corporate_page_content ADD COLUMN IF NOT EXISTS service_manager_role TEXT`);
    logger.info("corporate_page_content schema ready (idempotent)");

    // ── Corporate FAQ seed ────────────────────────────────────────────────────
    const existingCorporateFaq = await db.execute(sql`SELECT id FROM faqs WHERE page_slug = 'corporate' LIMIT 1`);
    if (!existingCorporateFaq.rows[0]) {
      const corporateFaqs = [
        { q: "Может ли ИП оформить автомобиль в лизинг?", a: "Да, лизинговые программы доступны как юридическим лицам, так и индивидуальным предпринимателям." },
        { q: "С какими лизинговыми компаниями вы работаете?", a: "Мы сотрудничаем с большинством ведущих лизинговых компаний России, что позволяет подобрать оптимальные условия под конкретную задачу бизнеса." },
        { q: "Можно ли взять в лизинг несколько автомобилей разных марок одновременно?", a: "Да, лизинговая схема доступна на любые бренды из нашего каталога, можно оформить сразу несколько автомобилей разных марок в рамках одной заявки." },
        { q: "Как проходит trade-in для корпоративного автопарка?", a: "Обмен нескольких автомобилей на новые можно провести в рамках одной сделки — оценка проводится по каждому автомобилю парка." },
        { q: "Нужна ли запись на сервисное обслуживание корпоративных автомобилей?", a: "Да, обслуживание проводится по предварительной записи — это позволяет обслужить ваш автопарк оперативно, без ожидания в общей очереди." },
        { q: "Есть ли отдельный менеджер для обслуживания нашего автопарка?", a: "Да, за корпоративными клиентами закрепляется персональный менеджер по сервису, отдельно от менеджера по продажам." },
      ];
      for (let i = 0; i < corporateFaqs.length; i++) {
        await db.execute(sql`
          INSERT INTO faqs (page_slug, question, answer, sort_order, is_published, include_in_schema)
          VALUES ('corporate', ${corporateFaqs[i].q}, ${corporateFaqs[i].a}, ${i + 1}, true, true)
        `);
      }
      logger.info("corporate_page_content: seeded 6 FAQ entries");
    }

    // ── SEO Autopilot tables ──────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wordstat_snapshots (
        id             SERIAL PRIMARY KEY,
        query          TEXT NOT NULL,
        shows_count    INTEGER NOT NULL DEFAULT 0,
        region_id      TEXT NOT NULL DEFAULT '191',
        source         TEXT NOT NULL,
        parent_query   TEXT,
        snapshot_date  DATE NOT NULL,
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (query, snapshot_date, source)
      )
    `);
    await db.execute(sql`ALTER TABLE wordstat_snapshots ADD COLUMN IF NOT EXISTS is_partial BOOLEAN NOT NULL DEFAULT false`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seo_suggestions (
        id               SERIAL PRIMARY KEY,
        type             TEXT NOT NULL,
        page_url         TEXT NOT NULL,
        current_value    TEXT,
        proposed_value   TEXT,
        reasoning        TEXT,
        priority_score   REAL NOT NULL DEFAULT 0,
        demand           INTEGER NOT NULL DEFAULT 0,
        position_factor  REAL NOT NULL DEFAULT 0,
        ease             REAL NOT NULL DEFAULT 0,
        status           TEXT NOT NULL DEFAULT 'pending',
        blocked_by_tech  BOOLEAN NOT NULL DEFAULT false,
        applied_at       TIMESTAMPTZ,
        verified_at      TIMESTAMPTZ,
        verification_log TEXT,
        result_delta     REAL,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (type, page_url)
      )
    `);

    // Keep applied suggestions as immutable history, while allowing GAP to
    // create a fresh active attempt for the same page/type after a negative
    // Karpathy evaluation. Pending/rejected rows remain deduplicated.
    await db.execute(sql`
      ALTER TABLE seo_suggestions
      DROP CONSTRAINT IF EXISTS seo_suggestions_type_page_url_key
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS seo_suggestions_active_type_page_url_idx
      ON seo_suggestions (type, page_url)
      WHERE status <> 'applied'
    `);

    // Петля Карпаты evaluation columns (idempotent — ADD COLUMN IF NOT EXISTS)
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS snapshot_before  JSONB`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS evaluate_at      TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS evaluated_at     TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS evaluation_result TEXT`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS evaluation_note  TEXT`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS content_draft    TEXT`);
    // GEO evidence and evaluation are separate from the Yandex/SEO Karpathy
    // fields above. JSONB keeps old SEO rows and their snapshot contract intact.
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_evidence           JSONB`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_snapshot_before   JSONB`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_evaluate_at       TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_evaluated_at      TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_evaluation_result  TEXT`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_evaluation_note    TEXT`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_result_delta       JSONB`);
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS geo_action             TEXT`);

    // Anchor-query priority boost flag (idempotent)
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS is_anchor_boosted BOOLEAN NOT NULL DEFAULT false`);

    // Manager last login timestamp
    await db.execute(sql`ALTER TABLE managers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seo_anchor_queries (
        id               SERIAL PRIMARY KEY,
        query_text       TEXT NOT NULL UNIQUE,
        page_url         TEXT NOT NULL,
        target_position  REAL NOT NULL DEFAULT 10,
        current_position REAL,
        last_checked_at  TIMESTAMPTZ,
        is_active        BOOLEAN NOT NULL DEFAULT true,
        notes            TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_alerts (
        id          SERIAL PRIMARY KEY,
        service     TEXT NOT NULL,
        status      TEXT NOT NULL,
        message     TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wordstat_quota (
        id                SERIAL PRIMARY KEY,
        date              DATE NOT NULL UNIQUE,
        calls_used        INTEGER NOT NULL DEFAULT 0,
        calls_estimated   INTEGER NOT NULL DEFAULT 0,
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // DB-layer meta overrides — written by SEO Autopilot apply for non-brand pages;
    // read by seoMeta.resolveMeta() before falling back to STATIC_META config.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS page_seo_overrides (
        route             TEXT PRIMARY KEY,
        meta_title        TEXT,
        meta_description  TEXT,
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // AI-generated SEO landing pages served at /p/:slug
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seo_landing_pages (
        id               SERIAL PRIMARY KEY,
        slug             TEXT UNIQUE NOT NULL,
        route            TEXT UNIQUE NOT NULL,
        meta_title       TEXT,
        meta_description TEXT,
        h1               TEXT,
        paragraphs       JSONB DEFAULT '[]',
        faq_items        JSONB DEFAULT '[]',
        is_published     BOOLEAN NOT NULL DEFAULT false,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    logger.info("SEO Autopilot tables ready (idempotent)");

    // ── AI Image Studio tables ─────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_image_sessions (
        id           SERIAL PRIMARY KEY,
        title        TEXT NOT NULL DEFAULT 'Новая сессия',
        model        TEXT NOT NULL DEFAULT 'gemini/gemini-3.1-flash-image-preview',
        admin_login  TEXT NOT NULL,
        admin_user_id INTEGER,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_image_messages (
        id                  SERIAL PRIMARY KEY,
        session_id          INTEGER NOT NULL REFERENCES ai_image_sessions(id) ON DELETE CASCADE,
        role                TEXT NOT NULL DEFAULT 'user',
        prompt              TEXT,
        image_urls          JSONB DEFAULT '[]',
        result_url          TEXT,
        input_tokens        INTEGER DEFAULT 0,
        input_text_tokens   INTEGER DEFAULT 0,
        input_image_tokens  INTEGER DEFAULT 0,
        output_tokens       INTEGER DEFAULT 0,
        total_tokens        INTEGER DEFAULT 0,
        error_message       TEXT,
        created_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_image_messages_session ON ai_image_messages(session_id)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_brand_assets (
        key         TEXT PRIMARY KEY,
        url         TEXT NOT NULL,
        instructions TEXT,
        position    TEXT DEFAULT 'southeast',
        size_pct    INTEGER DEFAULT 15,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE ai_brand_assets ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'southeast'`);
    await db.execute(sql`ALTER TABLE ai_brand_assets ADD COLUMN IF NOT EXISTS size_pct INTEGER DEFAULT 15`);
    logger.info("ai_image_sessions + ai_image_messages + ai_brand_assets schema ready (idempotent)");

    // Brand Guidelines tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_system_prompts (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        content     TEXT NOT NULL,
        is_default  BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_logo_variants (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        url         TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE ai_brand_assets ADD COLUMN IF NOT EXISTS brand TEXT`);
    logger.info("ai_system_prompts + ai_logo_variants + ai_brand_assets.brand ready");

    // Remove stale garbage landing page created by old buggy new_page logic (idempotent)
    await db.execute(sql`DELETE FROM seo_landing_pages WHERE slug = 'novosti-i-stati'`);
    await db.execute(sql`DELETE FROM seo_landing_pages WHERE slug = 'kontakty-i-rezhim-raboty'`);
    logger.info("seo_landing_pages: garbage cleanup done (idempotent)");

    // sitemap_extra_pages — durable storage for URLs approved via SEO Autopilot (idempotent)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sitemap_extra_pages (
        loc         TEXT PRIMARY KEY,
        changefreq  TEXT NOT NULL DEFAULT 'weekly',
        priority    TEXT NOT NULL DEFAULT '0.7',
        added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("sitemap_extra_pages schema ready (idempotent)");

    // reject_reason column (added with hallucination detection feature — idempotent)
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS reject_reason TEXT`);
    // generated_by is used by the SEO Autopilot apply pipelines and the admin
    // suggestions endpoint. Keep older development databases in sync with VPS.
    await db.execute(sql`ALTER TABLE seo_suggestions ADD COLUMN IF NOT EXISTS generated_by TEXT`);

    // Reject accumulated new_page suggestions for pages that already exist on the site.
    // The old SITE_WIDE COVERAGE code incorrectly created new_page suggestions for
    // /, /contacts, /about, /promotions, /brands/* etc. Real new_page suggestions
    // are only for /p/* AI landing pages. This cleans up any accumulated garbage.
    const staleNewPageCleanup = await db.execute(sql`
      UPDATE seo_suggestions
      SET status = 'rejected',
          reject_reason = 'Страница уже существует на сайте — исправлена логика GAP (миграция)',
          updated_at = NOW()
      WHERE type = 'new_page'
        AND page_url NOT LIKE '/p/%'
        AND status IN ('pending', 'applied')
    `);
    const staleCount = (staleNewPageCleanup as unknown as { rowCount: number }).rowCount ?? 0;
    if (staleCount > 0) {
      logger.info({ count: staleCount }, "seo_suggestions: rejected stale new_page records for existing pages");
    }

    // TO catalog external feeds — urls with brand labels for auto-sync
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS to_catalog_feeds (
        id          SERIAL PRIMARY KEY,
        url         TEXT NOT NULL,
        brand_name  TEXT NOT NULL DEFAULT '',
        last_synced_at TIMESTAMPTZ,
        last_count  INTEGER,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Migrate brand_name → brand_names (TEXT[]) if not yet done
    await db.execute(sql`
      ALTER TABLE to_catalog_feeds ADD COLUMN IF NOT EXISTS brand_names TEXT[] NOT NULL DEFAULT '{}'
    `);
    // Back-fill brand_names from brand_name for rows that still have it empty
    await db.execute(sql`
      UPDATE to_catalog_feeds
      SET brand_names = ARRAY[brand_name]
      WHERE brand_name <> '' AND brand_names = '{}'
    `);
    logger.info("to_catalog_feeds schema ready (idempotent)");

    // Track which static pages have been pinged via IndexNow (to auto-ping new ones on startup)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS indexnow_static_pings (
        loc        TEXT PRIMARY KEY,
        pinged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("indexnow_static_pings schema ready (idempotent)");

    // ── News image gallery — images text[] column ─────────────────────────────
    await db.execute(sql`ALTER TABLE news ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}'`);
    logger.info("news.images column ready (idempotent)");

  } catch (err) {
    logger.error({ err }, "Migration error");
  }
}
