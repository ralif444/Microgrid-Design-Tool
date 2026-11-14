// Chart series colours in the order of VISUAL_DESIGN_GUIDELINES §9 (light: teal, navy, Carbon purple 60,
// magenta 60, yellow 50; dark: tokens.css). None is a status colour (guideline §1 rule 4); series also
// differ by dash and marker. Feasibility markers use the status roles instead (§9, FEAS).
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"]; // tokens.css, per theme
export const DASH = ["", "6 3", "2 3", "8 3 2 3", "12 4"];
export const DASH_WORD = ["solid", "dashed", "dotted", "dash-dot", "long dash"];

export type Marker = "circle" | "square" | "triangle" | "diamond" | "cross" | "dash";

// §9 feasibility markers: shape + colour + legend word; icon steps of the status roles for contrast.
export const FEAS = {
  feasible: { marker: "circle" as Marker, color: "var(--role-success-icon)", filled: true },
  infeasible: { marker: "cross" as Marker, color: "var(--role-negative-icon)", filled: false },
  unavailable: { marker: "dash" as Marker, color: "var(--cds-border-strong-01)", filled: false },
};
