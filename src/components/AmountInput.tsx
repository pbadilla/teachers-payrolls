import { useEffect, useState } from "react";

interface Props {
  value?: number;
  placeholder?: string;
  label: string;
  disabled?: boolean;
  className?: string;
  onCommit: (value: number | undefined) => void;
}

/** Number input that saves when it loses focus (or on Enter); empty means "no value". */
export function AmountInput({ value, placeholder, label, disabled, className = "w-20", onCommit }: Props) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const commit = () => {
    const next = draft.trim() === "" ? undefined : Number(draft.replace(",", "."));
    if (next !== undefined && !Number.isFinite(next)) { setDraft(value === undefined ? "" : String(value)); return; }
    if (next !== value) onCommit(next);
  };
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
      className={`h-8 border border-slate-300 bg-white px-2 text-right font-mono text-xs outline-none focus:border-violet-500 disabled:opacity-50 ${className}`}
    />
  );
}
