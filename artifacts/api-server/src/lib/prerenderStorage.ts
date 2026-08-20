import { existsSync } from "fs";
import { writeFile, readFile, readdir, mkdir, unlink, rename, stat } from "fs/promises";
import path from "path";
import { logger } from "./logger";

export interface PrerenderManifest {
  route: string;
  generatedAt: string;
  generator: string;
  title?: string;
  canonical?: string;
  robots?: string;
  validationVersion?: number;
}

function getCacheDir(): string {
  return process.env.LOCAL_PRERENDER_CACHE_DIR || path.resolve(__dirname, "../prerender-cache");
}

function routeToFilePath(route: string): string {
  const cacheDir = getCacheDir();
  const clean = route === "/" ? "" : route.replace(/^\//, "").replace(/\/$/, "");
  const rel = clean ? `${clean}/index.html` : "index.html";
  return path.join(cacheDir, rel);
}

function routeToManifestPath(route: string): string {
  return routeToFilePath(route).replace(/index\.html$/, "prerender-manifest.json");
}

function filePathToRoute(filePath: string): string {
  const cacheDir = getCacheDir();
  const rel = filePath.startsWith(cacheDir) ? filePath.slice(cacheDir.length + 1) : filePath;
  const withoutSuffix = rel.replace(/\/index\.html$/, "").replace(/^index\.html$/, "");
  return withoutSuffix === "" ? "/" : `/${withoutSuffix}`;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, filePath);
}

/**
 * Publish an HTML snapshot only after it has passed the caller's validation.
 * Renaming a complete temporary file avoids exposing a half-written page to bots.
 */
export async function savePrerendered(
  route: string,
  html: string,
  manifest?: Omit<PrerenderManifest, "route" | "generatedAt">,
): Promise<void> {
  const filePath = routeToFilePath(route);
  await mkdir(path.dirname(filePath), { recursive: true });
  await atomicWrite(filePath, html);
  if (manifest) {
    await atomicWrite(
      routeToManifestPath(route),
      `${JSON.stringify({ route, generatedAt: new Date().toISOString(), ...manifest }, null, 2)}\n`,
    );
  }
}

export async function loadPrerendered(route: string): Promise<string | null> {
  const filePath = routeToFilePath(route);
  if (!existsSync(filePath)) return null;
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function deletePrerendered(route: string): Promise<void> {
  const filePath = routeToFilePath(route);
  try {
    await unlink(filePath);
  } catch {
  }
  try {
    await unlink(routeToManifestPath(route));
  } catch {
  }
}

export async function getPrerenderedMetadata(route: string): Promise<{
  manifest: PrerenderManifest | null;
  updatedAt: string | null;
}> {
  const filePath = routeToFilePath(route);
  let manifest: PrerenderManifest | null = null;
  try {
    manifest = JSON.parse(await readFile(routeToManifestPath(route), "utf-8")) as PrerenderManifest;
  } catch {
  }
  try {
    const fileStat = await stat(filePath);
    return { manifest, updatedAt: manifest?.generatedAt ?? fileStat.mtime.toISOString() };
  } catch {
    return { manifest, updatedAt: null };
  }
}

export async function listPrerenderedRoutes(): Promise<string[]> {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) return [];

  const routes: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name === "index.html") {
        routes.push(filePathToRoute(full));
      }
    }
  }

  await walk(cacheDir);
  return routes;
}

export async function countPrerendered(): Promise<number> {
  try {
    const routes = await listPrerenderedRoutes();
    return routes.length;
  } catch {
    logger.warn("prerenderStorage: countPrerendered failed");
    return -1;
  }
}

export async function loadAllPrerendered(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const routes = await listPrerenderedRoutes();
    await Promise.all(
      routes.map(async route => {
        const html = await loadPrerendered(route);
        if (html) result.set(route, html);
      })
    );
  } catch (err) {
    logger.warn({ err }, "prerenderStorage: loadAllPrerendered failed");
  }
  return result;
}
