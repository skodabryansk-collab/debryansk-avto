import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import sharp from "sharp";
import { IMAGE_MODELS, generateImage, generateImageWithReference } from "./timeweb-images";

const originalFetch = globalThis.fetch;
const originalKey = process.env.TIMEWEB_AI_GATEWAY_KEY;
const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "yellow" } }).png().toBuffer();
type Call = { url: string; body: FormData | Record<string, any> };
let calls: Call[] = [];
function mockProvider(model: string) {
  calls = [];
  process.env.TIMEWEB_AI_GATEWAY_KEY = "test-only";
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), body: init?.body instanceof FormData ? init.body : JSON.parse(String(init?.body)) });
    const data = model.startsWith("gemini/") && String(input).endsWith("/chat/completions")
      ? { choices: [{ message: { content: null, images: [{ image_url: { url: `data:image/png;base64,${png.toString("base64")}` } }] } }] }
      : { data: [{ b64_json: png.toString("base64") }] };
    return new Response(JSON.stringify({ ...data, usage: { total_tokens: 7, input_tokens: 3, output_tokens: 4 } }), { status: 200 });
  };
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.TIMEWEB_AI_GATEWAY_KEY;
  else process.env.TIMEWEB_AI_GATEWAY_KEY = originalKey;
});

for (const config of IMAGE_MODELS) {
  test(`${config.label}: correct text generation capability and payload`, async () => {
    mockProvider(config.value);
    if (!config.textToImage) {
      await assert.rejects(generateImage("test", config.value), /исходное изображение/);
      assert.equal(calls.length, 0);
      return;
    }
    const result = await generateImage("test", config.value, "1024x1792", "low");
    assert.deepEqual(result.buffer, png);
    assert.equal(calls[0]!.url, "https://api.timeweb.ai/v1/images/generations");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.model, config.value);
    assert.equal(body.quality, config.supportsQuality ? "low" : undefined);
    if (config.value.endsWith("seedream5_lite")) assert.equal(body.size, "1440x2560");
    assert.equal(result.usage.total_tokens, 7);
  });
  test(`${config.label}: sends every reference through the correct endpoint`, async () => {
    mockProvider(config.value);
    const result = await generateImageWithReference([{ buffer: png, mime: "image/png" }, { buffer: png, mime: "image/png" }], "edit", config.value, "1024x1024", "medium");
    assert.deepEqual(result.buffer, png);
    const call = calls[0]!;
    if (config.family === "gemini") {
      assert.ok(call.url.endsWith("/chat/completions"));
      assert.equal((call.body as Record<string, any>).messages[0].content.filter((p: any) => p.type === "image_url").length, 2);
    } else if (config.family === "runway") {
      assert.ok(call.url.endsWith("/images/generations"));
      const body = call.body as Record<string, any>;
      assert.equal(body.referenceImages.length, 2);
      assert.equal(Boolean(body.referenceImages[0].tag), !config.value.includes("seedream"));
      if (config.value.endsWith("seedream5_lite")) assert.equal(body.size, "2048x2048");
    } else {
      assert.ok(call.url.endsWith("/images/edits"));
      const form = call.body as FormData;
      assert.equal(form.get("model"), config.value);
      if (config.family === "gpt") {
        assert.equal(form.getAll("image").length, 2);
        assert.equal(form.get("quality"), "medium");
        assert.equal(form.get("size"), "1024x1024");
      } else {
        assert.ok(form.get("image"));
        assert.ok(form.get("image_2"));
        assert.equal(form.get("width"), "1024");
      }
    }
  });
}
test("a failed reference request never falls back to unrelated text generation", async () => {
  mockProvider("gemini/gemini-3.1-flash-image-preview");
  globalThis.fetch = async input => {
    calls.push({ url: String(input), body: {} });
    return new Response("provider failure", { status: 500 });
  };
  await assert.rejects(generateImageWithReference([{ buffer: png, mime: "image/png" }], "edit", "gemini/gemini-3.1-flash-image-preview"), /HTTP 500/);
  assert.equal(calls.length, 1);
});
test("a text-only response is an error, not a successful image generation", async () => {
  mockProvider("gemini/gemini-3.1-flash-image-preview");
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "I cannot generate" } }] }));
  await assert.rejects(generateImageWithReference([{ buffer: png, mime: "image/png" }], "edit", "gemini/gemini-3.1-flash-image-preview"), /не вернул изображение/);
});
test("invalid models, sizes, references and model-specific limits fail before any paid request", async () => {
  mockProvider("openai/gpt-image-2");
  await assert.rejects(generateImage("x", "unknown"), /недоступна/);
  await assert.rejects(generateImage("x", "openai/gpt-image-2", "invalid"), /размер/);
  await assert.rejects(generateImageWithReference([], "x", "openai/gpt-image-2"), /от 1/);
  await assert.rejects(generateImageWithReference(Array.from({ length: 4 }, () => ({ buffer: png, mime: "image/png" })), "x", "runway/gen4_image"), /до 3/);
  await assert.rejects(generateImageWithReference([{ buffer: Buffer.from("invalid"), mime: "image/png" }], "x", "openai/gpt-image-2"));
  assert.equal(calls.length, 0);
});
