import assert from "node:assert/strict";
import { normalizeRussianPhone, validateClientName } from "./manager-client-cards-validation";

assert.equal(normalizeRussianPhone("+7 (920) 607-28-57"), "+7 (920) 607-28-57");
assert.equal(normalizeRussianPhone("89206072857"), "+7 (920) 607-28-57");
assert.equal(normalizeRussianPhone("9206072857"), "+7 (920) 607-28-57");
assert.equal(normalizeRussianPhone("+7 (999) 999-99-99"), null);
assert.equal(normalizeRussianPhone("+7 (000) 000-00-00"), null);
assert.equal(normalizeRussianPhone("+7 (900) 000-00-00"), null);
assert.equal(normalizeRussianPhone("12345"), null);

assert.equal(validateClientName("Иванов Иван Иванович"), null);
assert.equal(validateClientName("Иван 2"), "В ФИО не должно быть цифр");
assert.equal(validateClientName("12"), "В ФИО не должно быть цифр");

console.info("manager client card validation tests passed");
