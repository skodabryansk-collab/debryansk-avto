import { useState, useCallback } from "react";

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let d = digits;
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);

  if (d.length === 0) return "";
  if (d.length <= 1) return "+7";
  if (d.length <= 4) return `+7 (${d.slice(1)}`;
  if (d.length <= 7) return `+7 (${d.slice(1, 4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

export function isPhoneValid(value: string): boolean {
  return value.replace(/\D/g, "").length === 11;
}

export function usePhoneMask(initial = "") {
  const [value, setValue] = useState(initial ? formatPhone(initial) : "");

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    if (input === "") { setValue(""); return; }
    setValue(formatPhone(input));
  }, []);

  const isValid = isPhoneValid(value);

  return { value, onChange, isValid };
}
