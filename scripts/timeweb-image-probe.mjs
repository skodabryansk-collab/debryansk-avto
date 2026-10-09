// Explicit, paid smoke tests against the SAME adapters used by the image centre.
// Run: pnpm --dir scripts exec tsx ../scripts/timeweb-image-probe.mjs <model-id> [...]
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getImageModel, generateImage, generateImageWithReference } from "../artifacts/api-server/src/lib/timeweb-images.ts";

const require = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const sharp = require("sharp");
const models = process.argv.slice(2);
if (!models.length) throw new Error("Pass explicit model IDs. These tests consume API credits.");
for (const model of models) getImageModel(model);
if (!process.env.TIMEWEB_AI_GATEWAY_KEY) throw new Error("TIMEWEB_AI_GATEWAY_KEY is required");
const out = `/tmp/timeweb-image-probes/${randomUUID()}`;
await mkdir(out, { recursive: true });
const reference = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#ffe600"/><rect x="40" y="160" width="180" height="180" fill="#e50000"/></svg>')).png().toBuffer();
await writeFile(`${out}/reference.png`, reference);
const results = [];
let failures = 0;
for (const model of models) {
  const config = getImageModel(model);
  for (const mode of ["edit", "generate"]) {
    if ((mode === "edit" && !config.imageToImage) || (mode === "generate" && !config.textToImage)) continue;
    const prompt = mode === "edit"
      ? "Edit the provided picture. Preserve the yellow background and the red square on the left exactly. Add a blue circle on the right. No text."
      : "A red square on the left and a blue circle on the right, on a plain yellow background. No text.";
    const start = Date.now();
    try {
      const result = mode === "edit"
        ? await generateImageWithReference([{ buffer: reference, mime: "image/png" }], prompt, model, "1024x1024", "low")
        : await generateImage(prompt, model, "1024x1024", "low");
      const meta = await sharp(result.buffer).metadata();
      const file = `${out}/${model.replaceAll("/", "_")}-${mode}.png`;
      await sharp(result.buffer).png().toFile(file);
      results.push({ model, mode, seconds: Math.round((Date.now() - start) / 1000), image: { width: meta.width, height: meta.height, bytes: result.buffer.length }, usage: result.usage, file });
    } catch (err) {
      failures++;
      results.push({ model, mode, error: String(err), seconds: Math.round((Date.now() - start) / 1000) });
    }
    console.log(JSON.stringify(results.at(-1)));
    await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  }
}
console.log(`Report: ${out}/results.json`);
process.exitCode = failures ? 1 : 0;
