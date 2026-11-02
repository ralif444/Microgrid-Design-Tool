"use client";
// S-02 Project overview (Doc 7 §2): name and nominal values (Doc 9 D-45 K2), counts, readiness.
import Link from "next/link";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";

function Overview() {
  const { project, design, runRecords } = useProject();
  const dispatch = useProjectDispatch();
  const issues = useValidation(design)?.issues ?? null;

  const counts: [string, number][] = [
    ["Buses", design.buses?.length ?? 0],
    ["Lines", design.lines?.length ?? 0],
    ["Loads", design.loads?.length ?? 0],
    ["Inverters", design.inverters?.length ?? 0],
    ["RunRecords", runRecords.length],
  ];
  return (
    <>
      <h1>Project overview</h1>
      <p>
        <label htmlFor="name">Project name</label>{" "}
        <input
          id="name"
          required
          maxLength={100}
          value={project?.name ?? ""}
          onChange={(e) => dispatch({ type: "projectUpdated", name: e.target.value })}
        />
      </p>
      <p>
        <NumberField
          id="kv"
          label="Nominal voltage, line-to-line"
          unit="kV"
          value={design.nominal_voltage_kv}
          onChange={(v) => dispatch({ type: "projectUpdated", nominal_voltage_kv: v })}
        />
      </p>
      <p>
        <NumberField
          id="hz"
          label="Nominal frequency"
          unit="Hz"
          value={design.nominal_frequency_hz}
          onChange={(v) => dispatch({ type: "projectUpdated", nominal_frequency_hz: v })}
        />
      </p>
      <table aria-label="Counts">
        <tbody>
          {counts.map(([k, n]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Design readiness for power flow (M1)</h2>
      {issues === null ? (
        <p>Checking the design…</p>
      ) : issues.length === 0 ? (
        <p>No problems found.</p>
      ) : (
        <ul aria-label="Readiness issues">
          {issues.map((i, k) => (
            <li key={k}>{[i.entity, i.id, i.field].filter(Boolean).join(" / ") || "Design"}: {i.message}</li>
          ))}
        </ul>
      )}
      <p>
        <Link href="/loads/">Continue to Loads</Link>
      </p>
    </>
  );
}

export default function ProjectPage() {
  return (
    <RequireProject>
      <Overview />
    </RequireProject>
  );
}
