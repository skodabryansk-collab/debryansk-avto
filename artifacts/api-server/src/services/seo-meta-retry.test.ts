import assert from "node:assert/strict";
import test from "node:test";
import {
  isMeaningfullyDifferentMeta,
  isMetaPairUnique,
  isValidMetaPair,
  parseMetaPair,
  serializeMetaPair,
} from "./seo-meta-retry";

const previous = {
  title: "Haval City в Брянске — официальный дилер | Дебрянск Авто",
  desc: "Купить Haval City в Брянске у официального дилера. Кредит, трейд-ин, гарантия.",
};

test("meta serialization round-trips title and description", () => {
  assert.deepEqual(parseMetaPair(serializeMetaPair(previous)), previous);
});

test("exact copy and punctuation-only changes are not new hypotheses", () => {
  assert.equal(isMeaningfullyDifferentMeta(previous, previous), false);
  assert.equal(
    isMeaningfullyDifferentMeta(
      { ...previous, title: "Haval City в Брянске — официальный дилер | Дебрянск Авто!" },
      previous,
    ),
    false,
  );
});

test("a materially different search-intent angle is accepted", () => {
  const candidate = {
    title: "Haval City: модельный ряд и консультация в Брянске",
    desc: "Подберите автомобиль Haval в Брянске: консультация, гарантийное обслуживание и запись на тест-драйв.",
  };
  assert.equal(isValidMetaPair(candidate), true);
  assert.equal(isMeaningfullyDifferentMeta(candidate, previous), true);
});

test("meta length limits are enforced", () => {
  assert.equal(isValidMetaPair({ title: "x".repeat(66), desc: "Описание" }), false);
  assert.equal(isValidMetaPair({ title: "Заголовок", desc: "x".repeat(161) }), false);
});

test("history comparison ignores punctuation and casing", () => {
  const candidate = { title: "Haval City Брянск", desc: "Новая формулировка описания страницы." };
  assert.equal(
    isMetaPairUnique(candidate, [serializeMetaPair(candidate).toUpperCase().replaceAll(".", "")]),
    false,
  );
  assert.equal(isMetaPairUnique(candidate, [serializeMetaPair(previous)]), true);
});
