/** Timeweb adapters: Gemini chat, GPT/FLUX multipart edits, Runway JSON referenceImages. */
export interface TokenUsage {
  total_tokens: number;
  input_tokens: number;
  input_text_tokens: number;
  input_image_tokens: number;
  output_tokens: number;
}
export interface ImageResult { buffer: Buffer; usage: TokenUsage }
export interface ReferenceFile { buffer: Buffer; mime: string }
export const ALLOWED_QUALITY = ["low", "medium", "high"] as const;
export type ImageQuality = typeof ALLOWED_QUALITY[number];
export const IMAGE_SIZES = ["1024x1024", "1024x1792", "1792x1024"] as const;
export type ImageSize = typeof IMAGE_SIZES[number];

function model(value: string, label: string, family: "gemini" | "gpt" | "flux" | "runway", available = true, reason = "") {
  return {
    value, label, family, available, reason,
    textToImage: value !== "runway/gen4_image_turbo",
    imageToImage: available,
    supportsQuality: family === "gpt",
    referenceLimit: value.startsWith("runway/gen4") ? 3 : 5,
  };
}

// Capabilities reflect the gateway endpoints, not just the upstream vendor's claims.
export const IMAGE_MODELS = [
  model("gemini/gemini-3.1-flash-image-preview", "Gemini 3.1 Flash", "gemini"),
  model("gemini/gemini-3-pro-image-preview", "Gemini 3 Pro", "gemini"),
  model("openai/gpt-image-2.5-flare", "GPT Image 2.5 Flare", "gpt"),
  model("openai/gpt-image-2.5-sunburst", "GPT Image 2.5 Sunburst", "gpt"),
  model("openai/gpt-image-2", "GPT Image 2", "gpt"),
  model("black_forest_labs/flux-2-max", "FLUX.2 Max", "flux"),
  model("black_forest_labs/flux-2-pro", "FLUX.2 Pro", "flux"),
  model("black_forest_labs/flux-2-klein-9b", "FLUX.2 Klein 9B", "flux"),
  model("runway/gen4_image", "Runway Gen-4 Image", "runway", true, "Timeweb помечает модель как устаревшую, но генерация через API проверена."),
  model("runway/gen4_image_turbo", "Runway Gen-4 Image Turbo", "runway", true, "Нужно исходное фото. Timeweb помечает модель как устаревшую, но API работает."),
  model("runway/seedream5_pro", "Seedream 5 Pro", "runway", true, "Timeweb помечает модель как устаревшую, но генерация через API проверена."),
  model("runway/seedream5_lite", "Seedream 5 Lite", "runway", true, "Минимальное разрешение — около 4 Мп. Timeweb помечает модель как устаревшую."),
] as const;
export const ALLOWED_MODELS = IMAGE_MODELS.filter(m => m.available).map(m => m.value);
export type ImageModel = typeof IMAGE_MODELS[number]["value"];
export const FLUX_MODELS = IMAGE_MODELS.filter(m => m.family === "flux").map(m => m.value);
const BASE_URL = "https://api.timeweb.ai/v1";

export function getImageModel(value: string) {
  const config = IMAGE_MODELS.find(m => m.value === value);
  if (!config?.available) throw new Error(config?.reason || `Модель '${value}' недоступна.`);
  return config;
}
function getKey() {
  const key = process.env["TIMEWEB_AI_GATEWAY_KEY"];
  if (!key) throw new Error("TIMEWEB_AI_GATEWAY_KEY не задан");
  return key;
}
function validateSize(size: string) {
  if (!(IMAGE_SIZES as readonly string[]).includes(size)) throw new Error(`Недопустимый размер: ${size}`);
}
function runwaySize(model: string, size: string) {
  if (model.endsWith("seedream5_lite")) {
    return size === "1024x1024" ? "2048x2048" : size === "1024x1792" ? "1440x2560" : "2560x1440";
  }
  return size === "1024x1024" ? size : size === "1024x1792" ? "1080x1920" : "1920x1080";
}
type Payload = {
  data?: Array<{ b64_json?: string; url?: string }>;
  usage?: {
    total_tokens?: number; input_tokens?: number; output_tokens?: number;
    prompt_tokens?: number; completion_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
};
async function request(path: string, body: FormData | Record<string, unknown>): Promise<Payload> {
  const multipart = body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getKey()}`, ...(!multipart ? { "Content-Type": "application/json" } : {}) },
    body: multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Timeweb ${path}: HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return await res.json() as Payload;
}
export async function generateImage(prompt: string, model: string, size = "1024x1024", quality?: ImageQuality): Promise<ImageResult> {
  const config = getImageModel(model);
  validateSize(size);
  if (!config.textToImage) throw new Error(`${config.label}: прикрепите исходное изображение.`);
  const body: Record<string, unknown> = { model, prompt, n: 1, size: config.family === "runway" ? runwaySize(model, size) : size };
  if (config.supportsQuality && quality) body.quality = quality;
  const json = await request("/images/generations", body);
  return { buffer: await extractImageBuffer(json), usage: extractUsage(json) };
}

export async function generateImageWithReference(
  files: ReferenceFile[], prompt: string, model: string, size = "1024x1024", quality?: ImageQuality,
): Promise<ImageResult> {
  const config = getImageModel(model);
  validateSize(size);
  if (!config.imageToImage) throw new Error(`${config.label} не поддерживает исходные изображения через Timeweb.`);
  if (!files.length || files.length > config.referenceLimit) {
    throw new Error(`Прикрепите от 1 до ${config.referenceLimit} изображений.`);
  }
  const sharp = (await import("sharp")).default;
  // Decode and normalize ALL references; invalid uploads must not be silently ignored.
  const prepared = await Promise.all(files.map(async ({ buffer }) => ({
    buffer: await sharp(buffer).rotate().png().toBuffer(), mime: "image/png",
  })));
  if (config.family === "runway") {
    const references = prepared.map((f, index) => {
      const uri = `data:${f.mime};base64,${f.buffer.toString("base64")}`;
      if (uri.length > 5 * 1024 * 1024) throw new Error("Runway: исходное фото превышает 5 МБ после подготовки. Уменьшите разрешение.");
      return { uri, ...(!model.includes("seedream") ? { tag: `ref${index + 1}` } : {}) };
    });
    const json = await request("/images/generations", { model, prompt, size: runwaySize(model, size), n: 1, referenceImages: references });
    return { buffer: await extractImageBuffer(json), usage: extractUsage(json) };
  }
  if (config.family === "gemini") {
    const json = await request("/chat/completions", {
      model,
      messages: [{ role: "user", content: [
        ...prepared.map(f => ({ type: "image_url", image_url: { url: `data:${f.mime};base64,${f.buffer.toString("base64")}` } })),
        { type: "text", text: prompt },
      ] }],
    });
    const chat = json as Payload & { choices?: Array<{ message?: {
      images?: Array<{ image_url?: { url?: string } }>;
      content?: string | Array<{ image_url?: { url?: string }; b64_json?: string }>;
    } }> };
    const msg = chat.choices?.[0]?.message;
    const image = msg?.images?.[0]?.image_url?.url;
    const content = Array.isArray(msg?.content) ? msg.content : [];
    const fallback = content.find(p => p.image_url?.url || p.b64_json);
    return {
      buffer: await extractImageBuffer({ data: [{ url: image || fallback?.image_url?.url, b64_json: fallback?.b64_json }] }),
      usage: extractUsage(json),
    };
  }
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  if (config.family === "gpt") {
    form.append("size", size);
    if (quality) form.append("quality", quality);
  } else {
    const [width, height] = size.split("x");
    form.append("width", width!);
    form.append("height", height!);
  }
  prepared.forEach((f, index) => {
    const field = config.family === "flux" && index > 0 ? `image_${index + 1}` : "image";
    form.append(field, new Blob([Uint8Array.from(f.buffer)], { type: f.mime }), `reference-${index + 1}.png`);
  });
  const json = await request("/images/edits", form);
  return { buffer: await extractImageBuffer(json), usage: extractUsage(json) };
}

async function extractImageBuffer(json: Payload): Promise<Buffer> {
  const item = json.data?.[0];
  let buffer: Buffer | undefined;
  if (item?.b64_json) buffer = Buffer.from(item.b64_json, "base64");
  else if (item?.url?.startsWith("data:image/")) {
    const match = item.url.match(/^data:image\/[^;]+;base64,(.+)$/s);
    if (match?.[1]) buffer = Buffer.from(match[1], "base64");
  } else if (item?.url) {
    const url = new URL(item.url);
    if (url.protocol !== "https:") throw new Error("Timeweb вернул небезопасную ссылку на изображение.");
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Не удалось скачать изображение: HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  if (!buffer?.length) throw new Error("Timeweb API не вернул изображение. Исходные фото не были заменены генерацией с нуля.");
  const sharp = (await import("sharp")).default;
  await sharp(buffer).metadata();
  return buffer;
}
function extractUsage(json: Payload): TokenUsage {
  const u = json.usage;
  return {
    total_tokens: u?.total_tokens ?? 0,
    input_tokens: u?.input_tokens ?? u?.prompt_tokens ?? 0,
    input_text_tokens: u?.input_tokens_details?.text_tokens ?? 0,
    input_image_tokens: u?.input_tokens_details?.image_tokens ?? 0,
    output_tokens: u?.output_tokens ?? u?.completion_tokens ?? 0,
  };
}
