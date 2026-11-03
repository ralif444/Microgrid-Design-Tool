// Numeric input with its unit (Doc 7 P3, FR-05); empty input = null (no defaults).
// The unit is drawn as a suffix and is also part of the label's accessible name: "Label (unit)".
import styles from "./NumberField.module.css";

export function NumberField({
  label,
  unit,
  value,
  onChange,
  id,
  step = "any",
  error,
  disabled,
}: {
  label: string;
  unit: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  id: string;
  step?: string;
  error?: string | null;
  disabled?: boolean;
}) {
  return (
    <span className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        <span className="sr-only"> ({unit})</span>
      </label>
      <span className={styles.control}>
        <input
          id={id}
          type="number"
          step={step}
          value={value ?? ""}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
        />
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      </span>
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
