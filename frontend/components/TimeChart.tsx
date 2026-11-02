// Time-response plot for S-14 (Doc 7 §6.6): inline SVG, one polyline per series told apart by
// dash pattern and a text legend (colour is not the only carrier, §8); a data table follows.
const W = 520;
const H = 220;
const PAD = 52;
const DASH = ["", "6 3", "2 3", "8 3 2 3"];

export function TimeChart({ time, series, label, unit }: { time: number[]; series: { name: string; values: number[] }[]; label: string; unit: string }) {
  const all = series.flatMap((s) => s.values);
  const [t0, t1] = [time[0] ?? 0, time[time.length - 1] ?? 1];
  const [y0, y1] = all.length ? [Math.min(...all), Math.max(...all)] : [0, 1];
  const sx = (t: number) => PAD + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);
  return (
    <figure>
      <svg role="img" aria-label={`${label} (${unit}) against time (s)`} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" />
        <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="12">
          time (s)
        </text>
        <text x={8} y={PAD - 14} fontSize="12">
          {label} ({unit})
        </text>
        <text x={PAD} y={H - PAD + 16} textAnchor="middle" fontSize="11">
          {t0}
        </text>
        <text x={W - PAD} y={H - PAD + 16} textAnchor="middle" fontSize="11">
          {t1}
        </text>
        <text x={PAD - 4} y={sy(y0)} textAnchor="end" fontSize="11">
          {Number(y0.toPrecision(6))}
        </text>
        <text x={PAD - 4} y={sy(y1) + 10} textAnchor="end" fontSize="11">
          {Number(y1.toPrecision(6))}
        </text>
        {series.map((s, k) => (
          <polyline
            key={s.name}
            fill="none"
            stroke="currentColor"
            strokeDasharray={DASH[k % DASH.length]}
            points={s.values.map((v, i) => `${sx(time[i])},${sy(v)}`).join(" ")}
          />
        ))}
      </svg>
      <figcaption>
        {series.map((s, k) => `${s.name}: ${["solid", "dashed", "dotted", "dash-dot"][k % DASH.length]}`).join(" · ")}
      </figcaption>
    </figure>
  );
}
