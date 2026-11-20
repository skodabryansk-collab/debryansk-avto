const FAKE_RUSSIAN_PHONE_NATIONAL_NUMBERS = new Set([
  "0000000000",
  "1234567890",
  "0123456789",
  "9876543210",
  "0987654321",
  "1231231231",
]);

export function normalizeRussianPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits[0] === "8") digits = `7${digits.slice(1)}`;

  if (!/^7[3-9]\d{9}$/.test(digits)) return null;
  const nationalNumber = digits.slice(1);
  if (
    /^(\d)\1{9}$/.test(nationalNumber) ||
    /(\d)\1{6,}/.test(nationalNumber) ||
    FAKE_RUSSIAN_PHONE_NATIONAL_NUMBERS.has(nationalNumber)
  ) {
    return null;
  }

  return `+7 (${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6, 8)}-${nationalNumber.slice(8, 10)}`;
}

export function validateClientName(value: string): string | null {
  const name = value.trim();
  if (name.length < 2) return "Укажите ФИО клиента";
  if (/\p{N}/u.test(name)) return "В ФИО не должно быть цифр";
  if (!/\p{L}/u.test(name)) return "Проверьте ФИО клиента";
  return null;
}
