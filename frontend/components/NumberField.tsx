// Numeric input with its unit (Doc 7 P3, FR-05); empty input = null (no defaults).
// The unit is drawn as a suffix and is also part of the label's accessible name: "Label (unit)".
// `adornment` sits after the unit and `note` under the input (example mode, Doc 12 X9); both absent = as before.
import { useEffect, useState, type ReactNode } from "react";
import { NOT_A_NUMBER, parseNumber } from "./format";
import styles from "./NumberField.module.css";

// Keeps the typed text (so "0," or "-" survive while typing) and sends only parsed numbers or null.
// Follows outside changes of `value` (restore, example fill, project load). `bad`: text is not a number.
export function useNumberText(value: number | null | undefined, onChange: (v: number | null) => void, integer = false) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    const p = parseNumber(text, integer);
    // invalid text was sent as null: keep the text so the user sees what to fix
    if (p !== (value ?? null) && !(p === undefined && value == null)) setText(value == null ? "" : String(value));
  }, [value]);
  return {
    text,
    bad: parseNumber(text, integer) === undefined,
    set: (s: string) => {
      setText(s);
      // text that is not a number clears the value, so a run never uses a number the field no longer shows
      onChange(parseNumber(s, integer) ?? null);
    },
  };
}

export function NumberField({
  label,
  unit,
  value,
  onChange,
  id,
  step = "any",
  error,
  disabled,
  adornment,
  note,
}: {
  label: string;
  unit: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  id: string;
  step?: string;
  error?: string | null;
  disabled?: boolean;
  adornment?: ReactNode;
  note?: ReactNode;
}) {
  const t = useNumberText(value, onChange, step === "1");
  const shown = error ?? (t.bad ? NOT_A_NUMBER : null);
  return (
    <span className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        <span className="sr-only"> ({unit})</span>
      </label>
      <span className={styles.control}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={t.text}
          disabled={disabled}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${id}-error` : undefined}
          onChange={(e) => t.set(e.target.value)}
        />
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
        {adornment}
      </span>
      {note && <span className={styles.note}>{note}</span>}
      {shown && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {shown}
        </span>
      )}
    </span>
  );
}
