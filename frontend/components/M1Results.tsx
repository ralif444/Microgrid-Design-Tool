// M1 payload with units (FR-23, NFR-05): the groups of Doc 3 §6.2 including ε_X. Placeholder
// values come from the Fake Engine.
import type { M1Payload } from "../api-types";

export function M1Results({ p }: { p: M1Payload }) {
  return (
    <section aria-label="Power flow results">
      <table aria-label="System totals">
        <caption>System</caption>
        <tbody>
          <tr><th scope="row">System frequency</th><td>{p.system_frequency_hz} Hz</td></tr>
          <tr><th scope="row">Total load</th><td>{p.total_load_kw} kW, {p.total_load_kvar} kvar</td></tr>
          <tr><th scope="row">Total losses</th><td>{p.total_losses_kw} kW</td></tr>
          <tr><th scope="row">Iterations</th><td>{p.iterations}</td></tr>
          <tr><th scope="row">Validity indicator ε_X</th><td>{p.epsilon_x_ratio} (ratio)</td></tr>
        </tbody>
      </table>
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
      <table>
        <caption>Line flows</caption>
        <thead>
          <tr>
            <th>Line</th><th>P from (kW)</th><th>Q from (kvar)</th><th>P to (kW)</th><th>Q to (kvar)</th>
            <th>Current (A)</th><th>Losses (kW)</th>
          </tr>
        </thead>
        <tbody>
          {p.line_results.map((l) => (
            <tr key={l.line_id}>
              <td>{l.line_id}</td><td>{l.p_from_kw}</td><td>{l.q_from_kvar}</td><td>{l.p_to_kw}</td><td>{l.q_to_kvar}</td>
              <td>{l.current_a}</td><td>{l.losses_kw}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
