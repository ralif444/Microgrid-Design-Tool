// Categorical series colours (Doc 12 X1, FR-86): Carbon palette values (@carbon/colors purple 70,
// cyan 50, teal 70, magenta 70, magenta 50, teal 50) that are not status colours (guideline §1
// rule 4), each at least 3:1 on white and on layer-02. Series also differ by dash and marker.
export const SERIES = ["#6929c4", "#1192e8", "#005d5d", "#9f1853", "#ee5396", "#009d9a"];
export const DASH = ["", "6 3", "2 3", "8 3 2 3", "12 4", "4 2 1 2"];
export const DASH_WORD = ["solid", "dashed", "dotted", "dash-dot", "long dash", "dash-dot-dot"];

export type Marker = "circle" | "square" | "triangle" | "diamond" | "cross";
