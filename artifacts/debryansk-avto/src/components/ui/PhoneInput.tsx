import React, { forwardRef } from "react";
import { formatPhone } from "@/hooks/usePhoneMask";
import { cn } from "@/lib/utils";

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: boolean;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, className, error, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      if (raw === "") {
        onChange({ ...e, target: { ...e.target, value: "" } });
        return;
      }
      const formatted = formatPhone(raw);
      onChange({ ...e, target: { ...e.target, value: formatted } });
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Backspace" && value.replace(/\D/g, "").length <= 1) {
        const synth = { ...e, target: { ...e.currentTarget, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(synth);
        e.preventDefault();
      }
    }

    return (
      <input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="+7 (___) ___-__-__"
        maxLength={18}
        className={cn(className, error ? "border-red-400 focus:border-red-500" : "")}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
export { PhoneInput };
