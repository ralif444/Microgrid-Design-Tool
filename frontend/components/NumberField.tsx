// Numeric input with its unit in the label (Doc 7 P3, FR-05); empty input = null (no defaults).
export function NumberField({
  label,
  unit,
  value,
  onChange,
  id,
  step = "any",
}: {
  label: string;
  unit: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  id: string;
  step?: string;
}) {
  return (
    <>
      <label htmlFor={id}>
        {label} ({unit})
      </label>{" "}
      <input
        id={id}
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
      />
    </>
  );
}
