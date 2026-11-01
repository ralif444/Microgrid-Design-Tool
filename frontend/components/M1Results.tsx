// M1 payload tables with units (FR-23, NFR-05). Placeholder values come from the Fake Engine.
import type { M1Payload } from "../api-types";

export function M1Results({ p }: { p: M1Payload }) {
  return (
    <section aria-label="Power flow results">
      <p>System frequency: {p.system_frequency_hz} Hz</p>
      <table>
        <caption>Bus voltages</caption>
        <thead>
          <tr><th>Bus</th><th>Voltage (kV)</th><th>Voltage (p.u.)</th><th>Angle (deg)</th></tr>
        </thead>
        <tbody>
          {p.bus_results.map((b) => (
            <tr key={b.bus_id}>
              <td>{b.bus_id}</td><td>{b.voltage_kv}</td><td>{b.voltage_pu}</td><td>{b.angle_deg}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table>
        <caption>Inverter outputs</caption>
        <thead>
          <tr><th>Inverter</th><th>P (kW)</th><th>Q (kvar)</th><th>S (kVA)</th><th>Loading (ratio)</th></tr>
        </thead>
        <tbody>
          {p.inverter_results.map((i) => (
            <tr key={i.inverter_id}>
              <td>{i.inverter_id}</td><td>{i.p_kw}</td><td>{i.q_kvar}</td><td>{i.s_kva}</td><td>{i.loading_ratio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
