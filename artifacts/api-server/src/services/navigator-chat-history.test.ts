import assert from "node:assert/strict";
import test from "node:test";
import { formatNavigatorChatHistoryRows } from "./navigator-chat-history.js";

test("formats newest-first messages as a chronological client/bot transcript", () => {
  const history = formatNavigatorChatHistoryRows([
    { role: "assistant", content: "Запишу вас на сервис." },
    { role: "user", content: "Нужна диагностика." },
  ]);

  assert.equal(history, "Клиент: Нужна диагностика.\nНавигатор: Запишу вас на сервис.");
});

test("trims empty messages and caps each message at 400 characters", () => {
  const history = formatNavigatorChatHistoryRows([
    { role: "assistant", content: "  " },
    { role: "user", content: "x".repeat(450) },
  ]);

  assert.equal(history.length, "Клиент: ".length + 400);
});
