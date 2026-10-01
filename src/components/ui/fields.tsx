import type { ReactNode } from "react";
import { ui } from "@/components/ui/styles";

type BaseProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  className?: string;
};

export function TextField({
  name,
  label,
  hint,
  className,
  defaultValue,
  type = "text",
  required,
  placeholder,
  maxLength = 200,
  autoComplete,
}: BaseProps & {
  defaultValue?: string | number | null;
  type?: "text" | "email" | "tel" | "number" | "datetime-local" | "password";
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={ui.label}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        maxLength={type === "number" ? undefined : maxLength}
        autoComplete={autoComplete}
        className={ui.input}
      />
      {hint && <span className={ui.hint}>{hint}</span>}
    </label>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  className,
  defaultValue,
  rows = 3,
  maxLength = 2000,
}: BaseProps & { defaultValue?: string | null; rows?: number; maxLength?: number }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={ui.label}>{label}</span>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={rows} maxLength={maxLength} className={ui.input} />
      {hint && <span className={ui.hint}>{hint}</span>}
    </label>
  );
}

export function SelectField({
  name,
  label,
  hint,
  className,
  defaultValue,
  options,
  emptyLabel,
}: BaseProps & {
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  /** When set, adds an empty option with this label. */
  emptyLabel?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={ui.label}>{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className={ui.input}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className={ui.hint}>{hint}</span>}
    </label>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  className,
  defaultChecked,
  value = "on",
}: BaseProps & { defaultChecked?: boolean; value?: string }) {
  return (
    <label className={`flex items-start gap-2 ${className ?? ""}`}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-stone-300"
      />
      <span className="text-sm text-stone-800">
        {label}
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}
