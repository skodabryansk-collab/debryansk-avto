import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { generateImage, generateImageWithReference, ALLOWED_MODELS, IMAGE_MODELS, getImageModel, IMAGE_SIZES } from "../lib/timeweb-images";
import { ListAiImageModelsResponse } from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const objectStorage = new ObjectStorageService();

const router: IRouter = Router();
router.use(requireAdmin);

router.get("/models", (_req, res) => {
  res.json(ListAiImageModelsResponse.parse({ ok: true, data: IMAGE_MODELS }));
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 5 },
});

/* ── helpers ────────────────────────────────────────────────── */
function getAdminLogin(req: unknown): { login: string; userId: number | null } {
  const payload = (req as Record<string, unknown>)["adminPayload"] as Record<string, unknown> | undefined;
  return {
    login: (payload?.["login"] as string) ?? "admin",
    userId: payload?.["id"] ? Number(payload["id"]) : null,
  };
}

async function saveGeneratedImage(imageBuffer: Buffer): Promise<string> {
  try {
    // Convert PNG → WebP via sharp if available, then save to local disk
    let buf = imageBuffer;
    let ext = ".png";
    let mime = "image/png";
    try {
      const sharp = (await import("sharp")).default;
      buf = await sharp(imageBuffer).webp({ quality: 85 }).toBuffer();
      ext = ".webp";
      mime = "image/webp";
    } catch { /* sharp unavailable, keep PNG */ }

    const objectPath = await objectStorage.uploadBuffer(buf, mime, ext);
    const siteUrl = (process.env["SITE_URL"] || "http://localhost:" + (process.env["PORT"] || "8080")).replace(/\/$/, "");
    return `${siteUrl}/api/storage${objectPath}`;
  } catch (err) {
    logger.warn({ err }, "[ai-images] saveGeneratedImage fallback to data URI");
    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
  }
}

/* ── GET /api/admin/ai-images/sessions ─────────────────────── */
router.get("/sessions", async (_req, res) => {
  try {
    const sessions = await db.execute(sql`
      SELECT
        s.id, s.title, s.model, s.admin_login, s.admin_user_id,
        s.created_at, s.updated_at,
        u.full_name AS user_full_name,
        (SELECT result_url FROM ai_image_messages
          WHERE session_id = s.id AND result_url IS NOT NULL
          ORDER BY created_at ASC LIMIT 1) AS preview_url,
        (SELECT COUNT(*) FROM ai_image_messages
          WHERE session_id = s.id AND role = 'assistant') AS message_count
      FROM ai_image_sessions s
      LEFT JOIN users u ON u.email = s.admin_login
      ORDER BY s.updated_at DESC
      LIMIT 100
    `);
    return res.json({ ok: true, data: sessions.rows });
  } catch (err) {
    logger.error({ err }, "[ai-images] sessions list failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /api/admin/ai-images/sessions ────────────────────── */
router.post("/sessions", async (req, res) => {
  try {
    const { login, userId } = getAdminLogin(req);
    const { title, model } = req.body as { title?: string; model?: string };
    if (model && !ALLOWED_MODELS.includes(model)) {
      return res.status(400).json({ ok: false, error: "Выбранная модель недоступна." });
    }

    const safeModel = model && (ALLOWED_MODELS as readonly string[]).includes(model)
      ? model
      : "gemini/gemini-3.1-flash-image-preview";

    const rows = await db.execute(sql`
      INSERT INTO ai_image_sessions (title, model, admin_login, admin_user_id)
      VALUES (
        ${title || "Новая сессия"},
        ${safeModel},
        ${login},
        ${userId}
      )
      RETURNING *
    `);
    return res.json({ ok: true, data: rows.rows[0] });
  } catch (err) {
    logger.error({ err }, "[ai-images] create session failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/ai-images/sessions/:id/messages ─────────── */
router.get("/sessions/:id/messages", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const session = await db.execute(sql`
      SELECT s.*, u.full_name AS user_full_name
      FROM ai_image_sessions s
      LEFT JOIN users u ON u.email = s.admin_login
      WHERE s.id = ${id}
    `);
    if (!session.rows[0]) return res.status(404).json({ ok: false, error: "Сессия не найдена" });

    const messages = await db.execute(sql`
      SELECT * FROM ai_image_messages
      WHERE session_id = ${id}
      ORDER BY created_at ASC
    `);
    return res.json({ ok: true, session: session.rows[0], data: messages.rows });
  } catch (err) {
    logger.error({ err }, "[ai-images] messages failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /api/admin/ai-images/sessions/:id/generate ────────── */
router.post(
  "/sessions/:id/generate",
  upload.array("files", 5),
  async (req, res) => {
    const id = Number(req.params["id"]);
    try {
      const session = await db.execute(sql`
        SELECT * FROM ai_image_sessions WHERE id = ${id}
      `);
      if (!session.rows[0]) return res.status(404).json({ ok: false, error: "Сессия не найдена" });

      const sess = session.rows[0] as {
        model: string; admin_login: string;
      };

      const { prompt, model: reqModel, size: reqSize, quality: reqQuality, include_logo, include_system_prompt, system_prompt_id, skip_auto_ref } = req.body as {
        prompt?: string; model?: string; size?: string; quality?: string; include_logo?: string;
        include_system_prompt?: string; system_prompt_id?: string; skip_auto_ref?: string;
      };

      const safeModel = reqModel || sess.model;
      try { getImageModel(safeModel); } catch (err) {
        return res.status(400).json({ ok: false, error: (err as Error).message });
      }

      const safeSize = reqSize && (IMAGE_SIZES as readonly string[]).includes(reqSize)
        ? reqSize
        : "1024x1024";

      const { ALLOWED_QUALITY } = await import("../lib/timeweb-images");
      const safeQuality = reqQuality && (ALLOWED_QUALITY as readonly string[]).includes(reqQuality)
        ? reqQuality as "low" | "medium" | "high"
        : undefined;

      const userPrompt = (prompt || "").trim();
      if (!userPrompt) return res.status(400).json({ ok: false, error: "Промпт не может быть пустым" });

      // Prepend system prompt if requested
      let finalPrompt = userPrompt;
      if (include_system_prompt === "true" || include_system_prompt === "1") {
        try {
          const spId = system_prompt_id ? Number(system_prompt_id) : null;
          const spResult = spId
            ? await db.execute(sql`SELECT content FROM ai_system_prompts WHERE id = ${spId} LIMIT 1`)
            : await db.execute(sql`SELECT content FROM ai_system_prompts WHERE is_default = TRUE LIMIT 1`);
          const spContent = (spResult.rows[0] as { content?: string } | undefined)?.content;
          if (spContent) finalPrompt = `${spContent}\n\n${userPrompt}`;
        } catch (e) {
          logger.warn({ e }, "[ai-images] failed to load system prompt, using raw prompt");
        }
      }

      // Save user message (save attached files to storage for display in chat)
      const multerFiles = (req.files as Express.Multer.File[]) ?? [];
      const attachedUrls: string[] = [];

      for (const file of multerFiles) {
        try {
          const url = await saveGeneratedImage(file.buffer);
          attachedUrls.push(url);
        } catch { /* skip */ }
      }

      await db.execute(sql`
        INSERT INTO ai_image_messages (session_id, role, prompt, image_urls)
        VALUES (${id}, 'user', ${userPrompt}, ${JSON.stringify(attachedUrls)}::jsonb)
      `);

      // Call Timeweb API
      let result_url = "";
      let usage = { total_tokens: 0, input_tokens: 0, input_text_tokens: 0, input_image_tokens: 0, output_tokens: 0 };
      let errorMessage: string | null = null;

      try {
        let result;

        // Fetch stored brand logo settings (for compositing after generation)
        let logoAsset: { buffer: Buffer; position: LogoPosition; sizePct: number } | null = null;
        if (include_logo === "true" || include_logo === "1") {
          try {
            const logoRow = await db.execute(sql`SELECT url, position, size_pct FROM ai_brand_assets WHERE key = 'logo'`);
            const logoData = logoRow.rows[0] as { url: string; position: string; size_pct: number } | undefined;
            if (logoData?.url) {
              let logoBuf: Buffer | null = null;

              // Try to read directly from disk (faster, no HTTP round-trip to self)
              if (!logoData.url.startsWith("data:")) {
                try {
                  const siteUrl = (process.env["SITE_URL"] || "").replace(/\/$/, "");
                  const storagePrefix = `${siteUrl}/api/storage`;
                  if (logoData.url.startsWith(storagePrefix)) {
                    const objectPath = logoData.url.slice(storagePrefix.length);
                    const localFile = await objectStorage.getObjectEntityFile(objectPath);
                    const { readFile } = await import("fs/promises");
                    logoBuf = await readFile(localFile.absolutePath);
                    logger.info({ objectPath, size: logoBuf.length }, "[ai-images] brand logo read from disk");
                  }
                } catch (diskErr) {
                  logger.warn({ diskErr }, "[ai-images] disk read failed, falling back to HTTP fetch");
                }
              }

              // Fallback: HTTP fetch (data: URIs or disk read failure)
              if (!logoBuf) {
                if (logoData.url.startsWith("data:")) {
                  const b64 = logoData.url.split(",")[1];
                  if (b64) logoBuf = Buffer.from(b64, "base64");
                } else {
                  const logoRes = await fetch(logoData.url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
                  if (logoRes?.ok) logoBuf = Buffer.from(await logoRes.arrayBuffer());
                }
              }

              if (logoBuf) {
                logoAsset = {
                  buffer: logoBuf,
                  position: (logoData.position || "southeast") as LogoPosition,
                  sizePct: logoData.size_pct ?? 15,
                };
                logger.info({ position: logoAsset.position, sizePct: logoAsset.sizePct }, "[ai-images] brand logo fetched for compositing");
              } else {
                logger.warn({ url: logoData.url }, "[ai-images] brand logo could not be loaded, skipping");
              }
            }
          } catch (e) {
            logger.warn({ e }, "[ai-images] failed to fetch brand logo, skipping");
          }
        }

        if (multerFiles.length > 0) {
          // Pass only user-uploaded files — logo is composited after generation, not sent to AI
          const refFiles = multerFiles.map(f => ({ buffer: f.buffer, mime: f.mimetype }));
          logger.info(
            { model: safeModel, count: refFiles.length },
            "[ai-images] generating with reference images",
          );
          result = await generateImageWithReference(refFiles, finalPrompt, safeModel, safeSize, safeQuality);
        } else {
          // No uploaded file — check if there's a previous generated result to use as reference
          const lastResult = await db.execute(sql`
            SELECT result_url FROM ai_image_messages
            WHERE session_id = ${id} AND result_url IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
          `);
          const lastUrl = skip_auto_ref === "true" ? null : lastResult.rows[0]
            ? (lastResult.rows[0] as { result_url: string }).result_url
            : null;

          if (lastUrl && !lastUrl.startsWith("data:")) {
            logger.info({ model: safeModel, lastUrl }, "[ai-images] generating with last result as reference");
            const imgRes = await fetch(lastUrl, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
            if (imgRes?.ok) {
              const imgBuf = Buffer.from(await imgRes.arrayBuffer());
              const imgMime = imgRes.headers.get("content-type") || "image/png";
              result = await generateImageWithReference([{ buffer: imgBuf, mime: imgMime }], finalPrompt, safeModel, safeSize, safeQuality);
            } else {
              throw new Error("Не удалось загрузить предыдущее изображение. Прикрепите его снова или выберите генерацию с нуля.");
            }
          } else {
            result = await generateImage(finalPrompt, safeModel, safeSize, safeQuality);
          }
        }

        usage = result.usage;

        // Composite brand logo on top of generated image (pixel-perfect, after AI generation)
        let finalBuffer = result.buffer;
        if (logoAsset) {
          try {
            finalBuffer = await compositeLogoOnImage(result.buffer, logoAsset.buffer, logoAsset.position, logoAsset.sizePct);
            logger.info({ position: logoAsset.position, sizePct: logoAsset.sizePct }, "[ai-images] logo composited onto result");
          } catch (compErr) {
            logger.warn({ err: compErr }, "[ai-images] logo compositing failed, saving without logo");
          }
        }

        result_url = await saveGeneratedImage(finalBuffer);
      } catch (genErr) {
        errorMessage = String(genErr);
        logger.error({ err: genErr }, "[ai-images] generation failed");
      }

      // Save assistant message
      const msgRows = await db.execute(sql`
        INSERT INTO ai_image_messages (
          session_id, role, prompt, result_url, error_message,
          input_tokens, input_text_tokens, input_image_tokens,
          output_tokens, total_tokens
        ) VALUES (
          ${id}, 'assistant', ${userPrompt},
          ${result_url || null}, ${errorMessage},
          ${usage.input_tokens}, ${usage.input_text_tokens}, ${usage.input_image_tokens},
          ${usage.output_tokens}, ${usage.total_tokens}
        )
        RETURNING *
      `);

      // Update session updated_at and title if it's the first message
      await db.execute(sql`
        UPDATE ai_image_sessions
        SET updated_at = NOW(),
            title = CASE
              WHEN title = 'Новая сессия' THEN ${userPrompt.slice(0, 60)}
              ELSE title
            END
        WHERE id = ${id}
      `);

      if (errorMessage) {
        return res.status(502).json({ ok: false, error: errorMessage, message: msgRows.rows[0] });
      }

      return res.json({ ok: true, message: msgRows.rows[0] });
    } catch (err) {
      logger.error({ err }, "[ai-images] generate endpoint failed");
      return res.status(500).json({ ok: false, error: String(err) });
    }
  }
);

/* ── DELETE /api/admin/ai-images/sessions/:id ──────────────── */
router.delete("/sessions/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    await db.execute(sql`DELETE FROM ai_image_sessions WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[ai-images] delete session failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/ai-images/stats ─────────────────────────── */
router.get("/stats", async (_req, res) => {
  try {
    const [sessions, requests, tokens, topUsers, byModel] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) AS total
        FROM ai_image_sessions
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT COUNT(*) AS total
        FROM ai_image_messages
        WHERE role = 'assistant' AND created_at >= NOW() - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(input_text_tokens), 0)  AS input_text,
          COALESCE(SUM(input_image_tokens), 0) AS input_image,
          COALESCE(SUM(output_tokens), 0)      AS output,
          COALESCE(SUM(total_tokens), 0)       AS total
        FROM ai_image_messages
        WHERE role = 'assistant' AND created_at >= NOW() - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT
          s.admin_login,
          COALESCE(u.full_name, s.admin_login) AS full_name,
          COALESCE(SUM(m.total_tokens), 0) AS total_tokens,
          COUNT(m.id) AS requests
        FROM ai_image_sessions s
        LEFT JOIN users u ON u.email = s.admin_login
        LEFT JOIN ai_image_messages m ON m.session_id = s.id AND m.role = 'assistant'
        WHERE s.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY s.admin_login, u.full_name
        ORDER BY total_tokens DESC
        LIMIT 3
      `),
      db.execute(sql`
        SELECT
          s.model,
          COUNT(m.id) AS count
        FROM ai_image_sessions s
        LEFT JOIN ai_image_messages m ON m.session_id = s.id AND m.role = 'assistant'
        WHERE s.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY s.model
        ORDER BY count DESC
      `),
    ]);

    const tok = tokens.rows[0] as {
      input_text: string; input_image: string; output: string; total: string;
    } ?? { input_text: "0", input_image: "0", output: "0", total: "0" };

    return res.json({
      ok: true,
      sessions: Number((sessions.rows[0] as { total: string })?.total ?? 0),
      requests: Number((requests.rows[0] as { total: string })?.total ?? 0),
      tokens: {
        inputText: Number(tok.input_text),
        inputImage: Number(tok.input_image),
        output: Number(tok.output),
        total: Number(tok.total),
      },
      topUsers: topUsers.rows,
      byModel: byModel.rows,
    });
  } catch (err) {
    logger.error({ err }, "[ai-images] stats failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Logo compositing helper ────────────────────────────────── */
type LogoPosition = "northwest" | "northeast" | "southwest" | "southeast";

async function compositeLogoOnImage(
  imageBuffer: Buffer,
  logoBuffer: Buffer,
  position: LogoPosition = "southeast",
  sizePct: number = 15,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 1024;
  const imgH = meta.height ?? 1024;

  const logoW = Math.max(60, Math.round(imgW * (sizePct / 100)));
  const padding = Math.round(imgW * 0.03);

  // Resize logo preserving aspect ratio; convert SVG→PNG if needed
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoW, undefined, { fit: "inside" })
    .png()
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const logoH = logoMeta.height ?? logoW;

  let top: number, left: number;
  switch (position) {
    case "northwest": top = padding; left = padding; break;
    case "northeast": top = padding; left = imgW - logoW - padding; break;
    case "southwest": top = imgH - logoH - padding; left = padding; break;
    case "southeast":
    default:          top = imgH - logoH - padding; left = imgW - logoW - padding; break;
  }

  return sharp(imageBuffer)
    .composite([{ input: resizedLogo, top: Math.max(0, top), left: Math.max(0, left) }])
    .png()
    .toBuffer();
}

/* ── GET /api/admin/ai-images/brand-assets/logo ─────────────── */
router.get("/brand-assets/logo", async (_req, res) => {
  try {
    const row = await db.execute(sql`SELECT url, instructions, position, size_pct FROM ai_brand_assets WHERE key = 'logo'`);
    const asset = row.rows[0] as { url: string; instructions: string | null; position: string; size_pct: number } | undefined;
    return res.json({ ok: true, data: asset ?? null });
  } catch (err) {
    logger.error({ err }, "[ai-images] brand-assets get failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /api/admin/ai-images/brand-assets/logo ────────────── */
router.post(
  "/brand-assets/logo",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ ok: false, error: "Файл не загружен" });
      const { instructions, position, size_pct } = req.body as {
        instructions?: string; position?: string; size_pct?: string;
      };
      const url = await saveGeneratedImage(file.buffer);
      await db.execute(sql`
        INSERT INTO ai_brand_assets (key, url, instructions, position, size_pct, updated_at)
        VALUES ('logo', ${url}, ${instructions ?? null}, ${position ?? 'southeast'}, ${Number(size_pct ?? 15)}, NOW())
        ON CONFLICT (key) DO UPDATE
          SET url = EXCLUDED.url,
              instructions = EXCLUDED.instructions,
              position = EXCLUDED.position,
              size_pct = EXCLUDED.size_pct,
              updated_at = NOW()
      `);
      return res.json({ ok: true, data: { url, instructions: instructions ?? null, position: position ?? 'southeast', size_pct: Number(size_pct ?? 15) } });
    } catch (err) {
      logger.error({ err }, "[ai-images] brand-assets upload failed");
      return res.status(500).json({ ok: false, error: String(err) });
    }
  },
);

/* ── PATCH /api/admin/ai-images/brand-assets/logo/settings ─── */
router.patch("/brand-assets/logo/settings", async (req, res) => {
  try {
    const { position, size_pct } = req.body as { position?: string; size_pct?: number };
    await db.execute(sql`
      UPDATE ai_brand_assets
      SET position = COALESCE(${position ?? null}, position),
          size_pct = COALESCE(${size_pct ?? null}, size_pct),
          updated_at = NOW()
      WHERE key = 'logo'
    `);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[ai-images] brand-assets settings update failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── DELETE /api/admin/ai-images/brand-assets/logo ─────────── */
router.delete("/brand-assets/logo", async (_req, res) => {
  try {
    await db.execute(sql`DELETE FROM ai_brand_assets WHERE key = 'logo'`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[ai-images] brand-assets delete failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /api/admin/ai-images/upscale ──────────────────────── */
router.post("/upscale", async (req, res) => {
  try {
    const { url, scale = 4 } = req.body as { url?: string; scale?: number };
    if (!url) return res.status(400).json({ ok: false, error: "url обязателен" });

    const factor = Math.min(Math.max(Number(scale) || 4, 2), 8);

    // Fetch source image
    const srcRes = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!srcRes.ok) return res.status(400).json({ ok: false, error: "Не удалось загрузить изображение" });
    const srcBuf = Buffer.from(await srcRes.arrayBuffer());

    // Get natural dimensions
    const sharp = (await import("sharp")).default;
    const meta = await sharp(srcBuf).metadata();
    const srcW = meta.width ?? 512;
    const srcH = meta.height ?? 512;
    const newW = srcW * factor;
    const newH = srcH * factor;

    logger.info({ srcW, srcH, factor, newW, newH }, "[ai-images] upscaling image");

    // Upscale with Lanczos3
    const upscaled = await sharp(srcBuf)
      .resize(newW, newH, { kernel: sharp.kernel.lanczos3, fit: "fill" })
      .webp({ quality: 92 })
      .toBuffer();

    const objectPath = await objectStorage.uploadBuffer(upscaled, "image/webp", ".webp");
    const siteUrl = (process.env["SITE_URL"] || `http://localhost:${process.env["PORT"] || 8080}`).replace(/\/$/, "");
    const resultUrl = `${siteUrl}/api/storage${objectPath}`;

    logger.info({ resultUrl, newW, newH }, "[ai-images] upscale done");
    return res.json({ ok: true, data: { url: resultUrl, width: newW, height: newH } });
  } catch (err) {
    logger.error({ err }, "[ai-images] upscale failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── Logo Variants ─────────────────────────────────────────── */
router.get("/logo-variants", async (_req, res) => {
  try {
    const rows = await db.execute(sql`SELECT id, name, url, created_at FROM ai_logo_variants ORDER BY id`);
    return res.json({ ok: true, data: rows.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/logo-variants", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: "Файл не загружен" });
    const { name } = req.body as { name?: string };
    const variantName = (name || file.originalname.replace(/\.[^.]+$/, "")).trim();
    const url = await saveGeneratedImage(file.buffer);
    const inserted = await db.execute(sql`
      INSERT INTO ai_logo_variants (name, url) VALUES (${variantName}, ${url}) RETURNING id, name, url, created_at
    `);
    return res.json({ ok: true, data: inserted.rows[0] });
  } catch (err) {
    logger.error({ err }, "[ai-images] logo-variant upload failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.delete("/logo-variants/:id", async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM ai_logo_variants WHERE id = ${Number(req.params["id"])}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── System Prompts ─────────────────────────────────────────── */
router.get("/system-prompts", async (_req, res) => {
  try {
    const rows = await db.execute(sql`SELECT * FROM ai_system_prompts ORDER BY is_default DESC, id`);
    return res.json({ ok: true, data: rows.rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/system-prompts", async (req, res) => {
  try {
    const { name, content, is_default = false } = req.body as { name?: string; content?: string; is_default?: boolean };
    if (!name?.trim() || !content?.trim()) return res.status(400).json({ ok: false, error: "name и content обязательны" });
    if (is_default) await db.execute(sql`UPDATE ai_system_prompts SET is_default = FALSE`);
    const inserted = await db.execute(sql`
      INSERT INTO ai_system_prompts (name, content, is_default) VALUES (${name.trim()}, ${content.trim()}, ${is_default}) RETURNING *
    `);
    return res.json({ ok: true, data: inserted.rows[0] });
  } catch (err) {
    logger.error({ err }, "[ai-images] system-prompt create failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.patch("/system-prompts/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { name, content, is_default } = req.body as { name?: string; content?: string; is_default?: boolean };
    if (is_default) await db.execute(sql`UPDATE ai_system_prompts SET is_default = FALSE WHERE id != ${id}`);
    await db.execute(sql`
      UPDATE ai_system_prompts
      SET name = COALESCE(${name ?? null}, name),
          content = COALESCE(${content ?? null}, content),
          is_default = COALESCE(${is_default ?? null}, is_default),
          updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM ai_system_prompts WHERE id = ${id}`);
    return res.json({ ok: true, data: updated.rows[0] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.delete("/system-prompts/:id", async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM ai_system_prompts WHERE id = ${Number(req.params["id"])}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── GET /api/admin/ai-images/brand-assets/fonts ────────────── */
router.get("/brand-assets/fonts", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT key, url FROM ai_brand_assets WHERE key LIKE 'font:%' ORDER BY key
    `);
    const fonts = (rows.rows as { key: string; url: string }[]).map(r => ({
      name: r.key.slice("font:".length),
      url: r.url,
    }));
    return res.json({ ok: true, data: fonts });
  } catch (err) {
    logger.error({ err }, "[ai-images] fonts list failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ── POST /api/admin/ai-images/brand-assets/fonts ───────────── */
router.post(
  "/brand-assets/fonts",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ ok: false, error: "Файл не загружен" });
      const { name } = req.body as { name?: string };
      const fontName = (name || file.originalname.replace(/\.[^.]+$/, "")).trim();
      if (!fontName) return res.status(400).json({ ok: false, error: "Укажите название шрифта" });

      // Determine extension from mime or original filename
      const extMap: Record<string, string> = {
        "font/ttf": ".ttf", "font/otf": ".otf",
        "font/woff": ".woff", "font/woff2": ".woff2",
        "application/font-woff": ".woff", "application/font-woff2": ".woff2",
        "application/x-font-ttf": ".ttf", "application/x-font-otf": ".otf",
      };
      const ext = extMap[file.mimetype] || file.originalname.match(/\.[^.]+$/)?.[0] || ".ttf";
      const objectPath = await objectStorage.uploadBuffer(file.buffer, file.mimetype || "font/ttf", ext);
      const siteUrl = (process.env["SITE_URL"] || `http://localhost:${process.env["PORT"] || 8080}`).replace(/\/$/, "");
      const url = `${siteUrl}/api/storage${objectPath}`;

      await db.execute(sql`
        INSERT INTO ai_brand_assets (key, url, updated_at)
        VALUES (${"font:" + fontName}, ${url}, NOW())
        ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, updated_at = NOW()
      `);
      return res.json({ ok: true, data: { name: fontName, url } });
    } catch (err) {
      logger.error({ err }, "[ai-images] font upload failed");
      return res.status(500).json({ ok: false, error: String(err) });
    }
  },
);

/* ── DELETE /api/admin/ai-images/brand-assets/fonts/:name ───── */
router.delete("/brand-assets/fonts/:name", async (req, res) => {
  try {
    const key = "font:" + decodeURIComponent(req.params["name"]!);
    await db.execute(sql`DELETE FROM ai_brand_assets WHERE key = ${key}`);
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[ai-images] font delete failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
