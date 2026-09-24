import assert from "node:assert/strict";
import test from "node:test";
import { parseMessageFilters } from "./chat";

test("Navigator can filter cars by all five integrated brands", () => {
  const cases: Array<[string, string]> = [
    ["покажи Jetour", "jetour"],
    ["покажи Jaecoo", "jaecoo"],
    ["покажи Omoda", "omoda"],
    ["покажи Tenet", "tenet"],
    ["покажи Chery", "chery"],
    ["покажи Soueast", "soueast"],
    ["покажи Соуист", "soueast"],
  ];

  for (const [message, brand] of cases) {
    assert.deepEqual(parseMessageFilters(message).brandTerms, [brand], message);
  }
});