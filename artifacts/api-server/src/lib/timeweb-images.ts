/**
 * Timeweb AI Gateway — image generation client.
 * Endpoint: https://api.timeweb.ai/v1
 * Auth: TIMEWEB_AI_GATEWAY_KEY (Bearer)
 *
 * Image with reference flow (Files API):
 *   1. POST /v1/files  →  file_id
 *   2. POST /v1/responses  with input_file: { file_id }  →  generated image
 *   3. DELETE /v1/files/:file_id  (cleanup)
 */

export interface TokenUsage {
  total_tokens: number;
  input_tokens: number;
  input_text_tokens: number;
  input_image_tokens: number;
  output_tokens: number;
}

export interface ImageResult {
  buffer: Buffer;
  usage: TokenUsage;
}

export const ALLOWED_MODELS = [
  "gemini/gemini-3-pro-image-preview",
  "gemini/gemini-3.1-flash-image-preview",
  "openai/gpt-image-2",
] as const;

export type ImageModel = (typeof ALLOWED_MODELS)[number];

export const IMAGE_SIZES = ["1024x1024", "1024x1792", "1792x1024"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

const BASE_URL = "https://api.timeweb.ai/v1";

function getKey(): string {
  const key = process.env["TIMEWEB_AI_GATEWAY_KEY"];
  if (!key) throw new Error("TIMEWEB_AI_GATEWAY_KEY не задан");
  return key;
}

function assertModel(model: string): asserts model is ImageModel {
  if (!(ALLOWED_MODELS as readonly string[]).includes(model)) {
    throw new Error(`Модель '${model}' не разрешена. Допустимые: ${ALLOWED_MODELS.join(", ")}`);
  }
}

interface TimewebImageResponse {
  data: Array<{ b64_json: string }>;
  usage?: {
    total_tokens?: number;
    input_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
    output_tokens?: number;
  };
}

// Responses API types (used for image-with-reference)
interface TimewebResponseOutput {
  type: string;
  result?: string;       // image_generation_call: base64 image
  content?: Array<{
    type: string;
    text?: string;
    image_url?: { url: string };
    b64_json?: string;
  }>;
}

interface TimewebResponsesResult {
  id?: string;
  output?: TimewebResponseOutput[];
  usage?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

// ─── Upload a file to Timeweb Files API ──────────────────────────────────────

async function uploadFileToTimeweb(
  buffer: Buffer,
  mime: string,
  filename: string,
  model: string,
): Promise<string> {
  // Timeweb Files API only accepts PNG/JPG — convert WebP on the fly
  let finalBuffer = buffer;
  let finalMime = mime;
  let finalName = filename;

  if (mime.includes("webp")) {
    try {
      const sharp = (await import("sharp")).default;
      finalBuffer = await sharp(buffer).png().toBuffer();
      finalMime = "image/png";
      finalName = filename.replace(/\.webp$/i, ".png");
    } catch { /* keep original if sharp fails */ }
  }

  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([Uint8Array.from(finalBuffer)], { type: finalMime }), finalName);
  form.append("target_model_names", model);

  const res = await fetch(`${BASE_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getKey()}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Timeweb Files upload error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { id: string; status?: string };
  if (!data.id) throw new Error("Timeweb Files API не вернул file_id");
  return data.id;
}

// Fire-and-forget cleanup to avoid accumulating files on Timeweb
function deleteFileFromTimeweb(fileId: string): void {
  fetch(`${BASE_URL}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getKey()}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => { /* ignore cleanup errors */ });
}

// ─── Extract base64 image from /v1/responses output ──────────────────────────

function extractB64FromResponsesOutput(output: TimewebResponseOutput[]): string | null {
  for (const item of output) {
    // Format 1: { type: "image_generation_call", result: "<b64>" }
    if (item.type === "image_generation_call" && item.result) {
      return item.result;
    }
    // Format 2: content array with b64_json or image_url data:
    if (Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c.b64_json) return c.b64_json;
        if (c.image_url?.url?.startsWith("data:image")) {
          // Strip data URI prefix: "data:image/png;base64,<b64>"
          const match = c.image_url.url.match(/^data:image\/[^;]+;base64,(.+)$/s);
          if (match?.[1]) return match[1];
        }
      }
    }
  }
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an image from a text prompt only.
 */
export const ALLOWED_QUALITY = ["low", "medium", "high"] as const;
export type ImageQuality = typeof ALLOWED_QUALITY[number];

export async function generateImage(
  prompt: string,
  model: string,
  size: string = "1024x1024",
  quality?: ImageQuality,
): Promise<ImageResult> {
  assertModel(model);

  // quality is only supported by GPT Image 2 via /images/generations
  const supportsQuality = model.includes("gpt-image");
  const bodyParams: Record<string, unknown> = { model, prompt, n: 1, size, response_format: "b64_json" };
  if (supportsQuality && quality && (ALLOWED_QUALITY as readonly string[]).includes(quality)) {
    bodyParams["quality"] = quality;
  }

  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyParams),
    signal: AbortSignal.timeout(240_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Timeweb API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as TimewebImageResponse;
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Timeweb API вернул пустой результат");

  return { buffer: Buffer.from(b64, "base64"), usage: extractUsage(json) };
}

export interface ReferenceFile {
  buffer: Buffer;
  mime: string;
}

/**
 * Generate an image using one or more reference images.
 * All files are passed as image_url parts inside a single user message
 * so the model can see every reference (e.g. base image + logo).
 */
export async function generateImageWithReference(
  files: ReferenceFile[],
  prompt: string,
  model: string,
  size: string = "1024x1024",
): Promise<ImageResult> {
  assertModel(model);

  // Convert WebP → PNG for each file (maximum compatibility)
  const prepared: ReferenceFile[] = await Promise.all(
    files.map(async ({ buffer, mime }) => {
      if (mime.includes("webp")) {
        try {
          const sharp = (await import("sharp")).default;
          return { buffer: await sharp(buffer).png().toBuffer(), mime: "image/png" };
        } catch { /* keep original */ }
      }
      return { buffer, mime };
    }),
  );

  // Build content array: all images first, then the text prompt
  const imageParts = prepared.map(({ buffer, mime }) => ({
    type: "image_url" as const,
    image_url: { url: `data:${mime};base64,${buffer.toString("base64")}` },
  }));

  // ── /chat/completions with image_url → parse message.images ─────────────
  // Gemini image models return generated images in message.images[], NOT in
  // message.content (which is null). This is the correct path for image-to-image.
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              ...imageParts,
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(240_000),
    });

    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as any;
      const msg = json?.choices?.[0]?.message;

      // Primary: message.images[] (Gemini image models via Timeweb)
      const imgUrl: string | undefined = msg?.images?.[0]?.image_url?.url;
      if (imgUrl) {
        const b64Match = imgUrl.match(/^data:image\/[^;]+;base64,(.+)$/s);
        if (b64Match?.[1]) {
          return { buffer: Buffer.from(b64Match[1], "base64"), usage: zeroUsage() };
        }
      }

      // Fallback: message.content as array with image parts
      const content = msg?.content;
      if (Array.isArray(content)) {
        for (const part of content) {
          const partUrl: string | undefined = part?.image_url?.url;
          if (partUrl?.startsWith("data:image")) {
            const m = partUrl.match(/^data:image\/[^;]+;base64,(.+)$/s);
            if (m?.[1]) return { buffer: Buffer.from(m[1], "base64"), usage: zeroUsage() };
          }
          if (part?.b64_json) return { buffer: Buffer.from(part.b64_json as string, "base64"), usage: zeroUsage() };
        }
      }
    }
  } catch { /* fall through to plain generation */ }

  // ── Fallback: plain generation without reference ──────────────────────────
  return generateImage(prompt, model, size);
}

function zeroUsage(): TokenUsage {
  return { total_tokens: 0, input_tokens: 0, input_text_tokens: 0, input_image_tokens: 0, output_tokens: 0 };
}

function extractUsage(json: TimewebImageResponse): TokenUsage {
  const u = json.usage;
  return {
    total_tokens: u?.total_tokens ?? 0,
    input_tokens: u?.input_tokens ?? 0,
    input_text_tokens: u?.input_tokens_details?.text_tokens ?? 0,
    input_image_tokens: u?.input_tokens_details?.image_tokens ?? 0,
    output_tokens: u?.output_tokens ?? 0,
  };
}
