// Inline SVG icons (ADR-011: no icon dependency). Decorative: the word next to it carries the meaning.
const PATHS = {
  check: "M3 8.5l3.2 3.2L13 4.8",
  cross: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  alert: "M5.5 1.8h5l3.7 3.7v5l-3.7 3.7h-5l-3.7-3.7v-5zM8 4.8v3.8M8 10.9v.3", // octagon: calculation failed
  ban: "M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM3.6 3.6l8.8 8.8", // not physically possible
  list: "M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.5M2.5 8h.5M2.5 12h.5",
  clock: "M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM8 4.5V8l2.5 1.8",
  link: "M6.8 9.2l2.4-2.4M7.4 4.6l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M8.6 11.4l-1 1a2.6 2.6 0 0 1-3.7-3.7l1-1",
  info: "M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zM8 7.2v4M8 4.8v.3",
  wrench: "M10.6 2.2a3.4 3.4 0 0 0-3.9 4.5L2.2 11.2l2.6 2.6 4.5-4.5a3.4 3.4 0 0 0 4.5-3.9l-2 2-2-.6-.6-2z",
  warn: "M8 2.2l6.3 11H1.7zM8 6.3v3.4M8 11.4v.3",
  dot: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={name === "dot" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none" }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
