import { Storage } from "@google-cloud/storage";
import { logger } from "./logger";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token" as const,
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account" as const,
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json" as const,
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function getBucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
}

function routeToObjectName(route: string): string {
  const clean = route === "/" ? "" : route.replace(/^\//, "").replace(/\/$/, "");
  return clean ? `prerendered/${clean}/index.html` : "prerendered/index.html";
}

function objectNameToRoute(name: string): string {
  const withoutPrefix = name.replace(/^prerendered\//, "");
  const withoutSuffix = withoutPrefix.replace(/\/index\.html$/, "").replace(/^index\.html$/, "");
  return withoutSuffix === "" ? "/" : `/${withoutSuffix}`;
}

export async function savePrerendered(route: string, html: string): Promise<void> {
  const file = gcs.bucket(getBucketId()).file(routeToObjectName(route));
  await file.save(Buffer.from(html, "utf-8"), {
    contentType: "text/html; charset=utf-8",
    resumable: false,
  });
}

export async function loadPrerendered(route: string): Promise<string | null> {
  const file = gcs.bucket(getBucketId()).file(routeToObjectName(route));
  const [exists] = await file.exists();
  if (!exists) return null;
  const [contents] = await file.download();
  return contents.toString("utf-8");
}

export async function deletePrerendered(route: string): Promise<void> {
  const file = gcs.bucket(getBucketId()).file(routeToObjectName(route));
  await file.delete({ ignoreNotFound: true });
}

export async function listPrerenderedRoutes(): Promise<string[]> {
  const [files] = await gcs.bucket(getBucketId()).getFiles({ prefix: "prerendered/" });
  return files.map(f => objectNameToRoute(f.name));
}

export async function countPrerendered(): Promise<number> {
  try {
    const [files] = await gcs.bucket(getBucketId()).getFiles({ prefix: "prerendered/" });
    return files.length;
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
