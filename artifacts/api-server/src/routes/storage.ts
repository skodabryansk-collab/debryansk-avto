import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import sharp from "sharp";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  type LocalFile,
  peekPendingUpload,
  resolvePendingUpload,
} from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const optimizedImageCache = new Map<string, Buffer>();
const MAX_OPTIMIZED_IMAGE_CACHE = 96;
const OPTIMIZED_WIDTHS = new Set([320, 480, 640, 800, 960, 1280, 1600]);

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/**
 * POST /storage/uploads/image
 *
 * Accepts a multipart image upload, compresses + converts to WebP via sharp,
 * saves to local disk, and returns the serving objectPath.
 * GIF files pass through unmodified.
 * Non-image files are rejected — use /storage/uploads/request-url instead.
 */
router.post("/storage/uploads/image", memUpload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const mime = req.file.mimetype;
    if (!mime.startsWith("image/")) {
      res.status(400).json({ error: "Only image files are accepted by this endpoint" });
      return;
    }

    let buffer: Buffer;
    let contentType: string;
    let extension = "";

    if (IMAGE_TYPES.has(mime)) {
      buffer = await sharp(req.file.buffer)
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      contentType = "image/webp";
      extension = ".webp";
    } else {
      buffer = req.file.buffer;
      contentType = mime;
    }

    const objectPath = await objectStorageService.uploadBuffer(buffer, contentType, extension);
    const url = `/api/storage${objectPath}`;
    res.json({ objectPath, url });
  } catch (error) {
    req.log.error({ err: error }, "Error processing image upload");
    res.status(500).json({ error: "Failed to process and upload image" });
  }
});

interface UploadRequestBody {
  name: string;
  size: number;
  contentType: string;
}

function isUploadRequestBody(body: unknown): body is UploadRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.name === "string" &&
    typeof b.size === "number" &&
    typeof b.contentType === "string"
  );
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a server-side upload URL for non-image files (PDF etc.).
 * Returns an uploadURL (pointing to our own server) and the final objectPath
 * that the caller must persist — the extension is already included.
 * Client then PUTs file body directly to uploadURL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!isUploadRequestBody(req.body)) {
    res.status(400).json({ error: "Missing or invalid required fields: name, size, contentType" });
    return;
  }

  try {
    const { name, size, contentType } = req.body;

    const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(contentType);

    res.json({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * PUT /storage/uploads/direct/:token
 *
 * Server-side direct upload handler.  The token must have been issued by a
 * prior call to POST /storage/uploads/request-url.  Unknown tokens are
 * rejected immediately before any body is read, preventing unauthorised disk
 * writes and memory/disk exhaustion.  Body is streamed directly to disk with
 * a 50 MB hard cap.
 */
router.put("/storage/uploads/direct/:token", async (req: Request, res: Response) => {
  const token = req.params.token as string;

  // Validate token BEFORE reading any body — reject unknown tokens immediately.
  const pending = peekPendingUpload(token);
  if (!pending) {
    res.status(403).json({ error: "Invalid or expired upload token" });
    return;
  }

  const contentLengthHeader = req.headers["content-length"];
  const contentLengthHint = contentLengthHeader ? Number(Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader) : undefined;

  try {
    // Consume the token so it cannot be replayed.
    resolvePendingUpload(token);

    const savedPath = await objectStorageService.saveDirectUploadStream(
      token,
      pending,
      req,
      contentLengthHint,
    );
    res.status(200).json({ objectPath: savedPath });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("exceeds maximum")) {
      res.status(413).json({ error: "File exceeds maximum upload size (50 MB)" });
    } else {
      req.log.error({ err: error }, "Error in direct upload");
      res.status(500).json({ error: "Failed to save upload" });
    }
  }
});

/**
 * GET /storage/public-objects/*filePath
 *
 * Serve public assets from uploads directory.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const localFile = await objectStorageService.searchPublicObject(filePath);
    if (!localFile) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(localFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*path
 *
 * Serve uploaded files from local disk.
 * This also serves call recordings stored under call-recordings/<callId>.mp3
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const localFile = await objectStorageService.getObjectEntityFile(objectPath);

    if (req.query.format !== undefined || req.query.width !== undefined) {
      const width = Number(req.query.width);
      if (req.query.format !== "webp" || !Number.isInteger(width) || !OPTIMIZED_WIDTHS.has(width)) {
        res.status(400).json({ error: "Unsupported image variant" });
        return;
      }

      const cacheKey = `${objectPath}:webp:${width}`;
      let image = optimizedImageCache.get(cacheKey);
      if (!image) {
        const source = await objectStorageService.downloadObject(localFile);
        if (!source.ok || !source.body) {
          res.status(source.status).end();
          return;
        }
        const sourceSize = Number(source.headers.get("content-length") ?? 0);
        if (Number.isFinite(sourceSize) && sourceSize > 20 * 1024 * 1024) {
          res.status(413).json({ error: "Image is too large to resize" });
          return;
        }
        const sourceBuffer = Buffer.from(await source.arrayBuffer());
        const metadata = await sharp(sourceBuffer, { failOn: "none" }).metadata();
        if (!metadata.width || !metadata.height || !metadata.format) {
          res.status(415).json({ error: "Stored object is not a supported image" });
          return;
        }
        image = await sharp(sourceBuffer, { failOn: "none", animated: (metadata.pages ?? 1) > 1 })
          .rotate()
          .resize({ width, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toBuffer();
        if (optimizedImageCache.size >= MAX_OPTIMIZED_IMAGE_CACHE) {
          const oldestKey = optimizedImageCache.keys().next().value;
          if (oldestKey) optimizedImageCache.delete(oldestKey);
        }
        optimizedImageCache.set(cacheKey, image);
      }

      res.status(200)
        .setHeader("Content-Type", "image/webp")
        .setHeader("Content-Length", String(image.byteLength))
        .setHeader("Cache-Control", "public, max-age=31536000, immutable")
        .end(image);
      return;
    }

    const response = await objectStorageService.downloadObject(localFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
