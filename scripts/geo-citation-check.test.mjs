import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./geo-citation-check.mjs", import.meta.url));

function listChatGptSource({ endpoint, model = "" }) {
  return execFileSync(process.execPath, [scriptPath, "--list-sources"], {
    encoding: "utf8",
    env: {
      ...process.env,
      GEO_CHATGPT_API_URL: endpoint,
      GEO_CHATGPT_API_KEY: "test-key",
      GEO_CHATGPT_MODEL: model,
      GEO_PERPLEXITY_API_KEY: "",
      PERPLEXITY_API_KEY: "",
    },
  });
}

test("uses a provider-qualified default model for the Timeweb gateway", () => {
  const output = listChatGptSource({ endpoint: "https://api.timeweb.ai/v1/responses" });
  assert.match(output, /модель: openai\/gpt-4\.1/);
});

test("keeps the direct OpenAI model name for OpenAI endpoints", () => {
  const output = listChatGptSource({ endpoint: "https://api.openai.com/v1/responses" });
  assert.match(output, /модель: gpt-4\.1\)/);
});

test("respects an explicit GEO model override", () => {
  const output = listChatGptSource({
    endpoint: "https://api.timeweb.ai/v1/responses",
    model: "custom-model",
  });
  assert.match(output, /модель: custom-model/);
});