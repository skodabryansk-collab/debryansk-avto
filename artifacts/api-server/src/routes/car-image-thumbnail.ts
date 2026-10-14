import { Router, type IRouter } from "express";
import sharp from "sharp";

const router: IRouter = Router();
const cache = new Map<string, Buffer>();
const inFlight = new Map<string, Promise<Buffer>>();
const MAX_CACHE_ENTRIES = 96;
const MAX_CACHE_BYTES = 24 * 1024 * 1024;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_PATH = /^\/get-cme-media\/\d+\/[a-f0-9-]{16,64}\/optimize$/i;
const MAX_CONCURRENT_RESIZES = 2;
let cachedBytes = 0;
let activeResizes = 0;
const resizeQueue: Array<() => void> = [];

function cacheImage(key: string, image: Buffer): void {
  if (image.byteLength > MAX_CACHE_BYTES) return;
  const previous = cache.get(key);
  if (previous) {
    cachedBytes -= previous.byteLength;
    cache.delete(key);
  }
  while (cache.size >= MAX_CACHE_ENTRIES || cachedBytes + image.byteLength > MAX_CACHE_BYTES) {
    const oldest = cache.entries().next().value as [string, Buffer] | undefined;
    if (!oldest) break;
    cache.delete(oldest[0]);
    cachedBytes -= oldest[1].byteLength;
  }
  cache.set(key, image);
  cachedBytes += image.byteLength;
}

async function withResizeSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeResizes >= MAX_CONCURRENT_RESIZES) {
    await new Promise<void>((resolve) => resizeQueue.push(resolve));
  }
  activeResizes++;
  try {
    return await work();
  } finally {
    activeResizes--;
    resizeQueue.shift()?.();
  }
}

async function readLimited(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Source image exceeds size limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

async function createThumbnail(sourceUrl: string): Promise<Buffer> {
  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "Mozilla/5.0", accept: "image/*" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || !response.body) throw new Error(`Image source returned ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_SOURCE_BYTES) throw new Error("Source image exceeds size limit");
  const source = await readLimited(response.body, MAX_SOURCE_BYTES);
  const metadata = await sharp(source, { failOn: "none" }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error("Unsupported image");
  return sharp(source, { failOn: "none" })
    .rotate()
    .resize({ width: 640, height: 384, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
}

router.get("/cars/image-thumbnail", async (req, res): Promise<void> => {
  const rawSource = req.query.src;
  if (typeof rawSource !== "string") {
    res.status(400).json({ error: "Invalid image source" });
    return;
  }

  let source: URL;
  try {
    source = new URL(rawSource);
  } catch {
    res.status(400).json({ error: "Invalid image source" });
    return;
  }
  if (
    source.protocol !== "https:" ||
    source.hostname !== "avatars.avto.ru" ||
    source.port ||
    source.username ||
    source.password ||
    source.search ||
    source.hash ||
    !MAX_SOURCE_PATH.test(source.pathname)
  ) {
    res.status(400).json({ error: "Unsupported image source" });
    return;
  }

  const key = source.href;
  let image = cache.get(key);
  if (image) {
    cache.delete(key);
    cache.set(key, image);
  } else {
    let pending = inFlight.get(key);
    if (!pending) {
      pending = withResizeSlot(() => createThumbnail(key));
      inFlight.set(key, pending);
    }
    try {
      image = await pending;
      cacheImage(key, image);
    } catch (error) {
      req.log.warn({ err: error }, "Unable to create vehicle thumbnail");
      res.status(502).json({ error: "Unable to process source image" });
      return;
    } finally {
      inFlight.delete(key);
    }
  }

  res.status(200)
    .setHeader("Content-Type", "image/webp")
    .setHeader("Content-Length", String(image.byteLength))
    .setHeader("Cache-Control", "public, max-age=2592000, immutable")
    .end(image);
});

export default router;
