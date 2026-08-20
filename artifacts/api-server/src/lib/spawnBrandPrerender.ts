/**
 * Shared utility: fire-and-forget prerender trigger for /brands/:slug.
 *
 * Brand pages are served via Puppeteer prerender cache (not SSG), so any change
 * to brand_page_content must trigger prerender.mjs --route /brands/:slug.
 *
 * Usage:
 *   import { spawnBrandPrerenderBySlug, spawnBrandPrerenderById } from "../lib/spawnBrandPrerender";
 *   // fire-and-forget (non-blocking):
 *   spawnBrandPrerenderBySlug(slug);
 *   spawnBrandPrerenderById(brandId).catch(() => {});
 */

import { existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { logger } from "./logger";

function getPrerenderScriptPath(): string | null {
  const vpsPath = "/opt/debryansk/scripts/prerender.mjs";
  if (existsSync(vpsPath)) return vpsPath;
  const devPath = join(process.cwd(), "artifacts/api-server/scripts/prerender.mjs");
  if (existsSync(devPath)) return devPath;
  return null;
}

/**
 * Spawn prerender.mjs --route /brands/:slug (fire-and-forget, synchronous dispatch).
 * Call this when the brand slug is already known.
 */
export function spawnBrandPrerenderBySlug(slug: string): void {
  if (!slug) return;
  spawnPrerenderRoute(`/brands/${slug}`);
}

/** Start a safe, single-route Puppeteer refresh for any registered dynamic route. */
export function spawnPrerenderRoute(route: string): void {
  if (process.env.PRERENDER_ENABLED !== "true") return;
  if (!route.startsWith("/") || route.includes("..")) return;

  const scriptPath = getPrerenderScriptPath();
  if (!scriptPath) {
    logger.warn({ route }, "spawnPrerenderRoute: prerender.mjs not found, skipping");
    return;
  }

  try {
    const child = spawn("node", [scriptPath, "--route", route], {
      detached: true,
      stdio: "ignore",
      env: process.env,
      cwd: process.cwd(),
    });
    child.unref();
    logger.info({ route }, "spawnPrerenderRoute: prerender triggered");
  } catch (err) {
    logger.warn({ err, route }, "spawnPrerenderRoute: spawn failed (non-fatal)");
  }
}

/**
 * Async variant: looks up brand slug from the DB by brandId, then spawns prerender.
 * Safe to call fire-and-forget: spawnBrandPrerenderById(brandId).catch(() => {});
 */
export async function spawnBrandPrerenderById(brandId: number): Promise<void> {
  if (process.env.PRERENDER_ENABLED !== "true") return;
  try {
    const { db, brandsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ slug: brandsTable.slug })
      .from(brandsTable)
      .where(eq(brandsTable.id, brandId));
    const slug = rows[0]?.slug;
    if (!slug) {
      logger.warn({ brandId }, "spawnBrandPrerender: brand has no slug, skipping prerender");
      return;
    }
    spawnBrandPrerenderBySlug(slug);
  } catch (err) {
    logger.warn({ err, brandId }, "spawnBrandPrerender: slug lookup failed (non-fatal)");
  }
}
