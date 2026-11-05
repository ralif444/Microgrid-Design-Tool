// K147: 6 significant digits hide unit round-trip noise (49.75000000000001 Hz); display only.
export const num = (v: number) => Number(v.toPrecision(6));
