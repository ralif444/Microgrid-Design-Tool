// M2 result parts (Doc 7 §5.1, §6.4): limiting constraints / margins, "not evaluated" list,
// loadability, SizingCheck in an advisory panel separate from SizingAdvice (FR-25, FR-16, FR-24, FR-27).
import Link from "next/link";
import type { LimitingConstraint, M2Payload } from "../api-types";

export const KIND_WORDS: Record<string, string> = {
  BUS_VOLTAGE_MIN: "Bus voltage, lower limit",
  BUS_VOLTAGE_MAX: "Bus voltage, upper limit",
  FREQUENCY_MIN: "Frequency, lower limit",
  FREQUENCY_MAX: "Frequency, upper limit",
  INVERTER_LOADING: "Inverter loading",
  LINE_CURRENT: "Line current",
  POWER_BALANCE: "Power balance",
};

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "not available" : String(v));

// `shortcut`: per-row link to M3a pre-filled for that constraint (Doc 12 FR-84), on S-08 only.
export function ConstraintTable({ label, rows, shortcut = false }: { label: string; rows: LimitingConstraint[]; shortcut?: boolean }) {
  return (
    <table aria-label={label}>
      <caption>{label}</caption>
      <thead>
        <tr>
          <th>Constraint</th>
          <th>Element</th>
          <th>Value</th>
          <th>Limit</th>
          <th>Margin</th>
          {shortcut && <th>Next step</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((c, k) => (
          <tr key={k}>
            <td>{KIND_WORDS[c.kind] ?? c.kind}</td>
            <td>
              {c.element_id === "SYSTEM" ? (
                c.element_id
              ) : (
                // D-48 K22: open the element's row in S-05
                <Link href={`/network/?focus=${encodeURIComponent(c.element_id)}`}>{c.element_id}</Link>
              )}
            </td>
            <td>
              {c.value} {c.unit}
            </td>
            <td>
              {c.limit} {c.unit}
            </td>
            <td>{c.margin < 0 ? `Violated by ${-c.margin} ${c.unit}` : `${c.margin} ${c.unit}`}</td>
            {shortcut && (
              <td>
                {c.kind !== "POWER_BALANCE" && (
                  <Link href={`/sensitivity/?kind=${encodeURIComponent(c.kind)}&element=${encodeURIComponent(c.element_id)}`}>
                    Most influential parameters for {c.element_id}
                  </Link>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function M2Results({ p }: { p: M2Payload }) {
  const l = p.loadability;
  const s = p.sizing_check;
  return (
    <section aria-label="Constraint check results">
      {p.constraint_margins.length > 0 && <ConstraintTable label="All evaluated margins" rows={p.constraint_margins} />}
      <h2>Not evaluated</h2>
      {p.not_evaluated.length === 0 ? (
        <p>Every check had a limit.</p>
      ) : (
        <ul aria-label="Not evaluated">
          {p.not_evaluated.map((n, k) => (
            <li key={k}>
              {KIND_WORDS[n.kind] ?? n.kind}, {n.element_id}: no limit given; not counted as satisfied.
            </li>
          ))}
        </ul>
      )}
      <h2>Loadability</h2>
      <p>
        λ_c (constraint loadability): {fmt(l.lambda_c)}. λ_s: {fmt(l.lambda_s)} (solution existence, not a stability
        limit). Resolution {fmt(l.resolution)}, grid step {fmt(l.grid_step)}, stop reason {l.stop_reason ?? "none"}.
      </p>
      <section className="advice" aria-label="Sizing check">
        <p className="advice-tag">Sizing check (advisory, from the network)</p>
        <table aria-label="Sizing check per inverter">
          <thead>
            <tr>
              <th>Inverter</th>
              <th>S (kVA)</th>
              <th>Required rating (kVA)</th>
              <th>Headroom (kVA)</th>
              <th>Rating margin short</th>
            </tr>
          </thead>
          <tbody>
            {s.per_inverter.map((i) => (
              <tr key={i.inverter_id}>
                <td>{i.inverter_id}</td>
                <td>{i.s_kva}</td>
                <td>{i.required_rating_kva}</td>
                <td>{i.headroom_kva}</td>
                <td>{i.rating_margin_short ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table aria-label="Sizing check per line">
          <thead>
            <tr>
              <th>Line</th>
              <th>Current (A)</th>
              <th>Required current (A)</th>
            </tr>
          </thead>
          <tbody>
            {s.per_line.map((ln) => (
              <tr key={ln.line_id}>
                <td>{ln.line_id}</td>
                <td>{ln.current_a}</td>
                <td>{ln.required_current_a}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {s.storage ? `Storage energy: AC ${s.storage.e_ac_kwh} kWh (stage ${s.storage.stage}). ` : "No storage check. "}
          {s.basis} {s.assumptions.join(" ")}
        </p>
      </section>
    </section>
  );
}
