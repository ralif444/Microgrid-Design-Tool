"use client";
// Lays out the model once per topology (guideline §4.3): value edits keep the same key, so no re-layout;
// a topology edit re-lays out 150 ms after the last change (guideline §9).
import { useEffect, useState } from "react";
import type { SldModel } from "./buildSldModel";
import { layoutSld, type SldLayout } from "./layoutSld";

export function useSldLayout(model: SldModel): { layout: SldLayout | null; failed: boolean } {
  const [state, setState] = useState<{ key: string; layout: SldLayout | null; failed: boolean }>({ key: "", layout: null, failed: false });
  const key = model.topologyKey;
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      layoutSld(model).then(
        (layout) => live && setState({ key, layout, failed: false }),
        () => live && setState({ key, layout: null, failed: true }),
      );
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // the model's values change without changing the layout; only the topology key re-runs it
  }, [key]);
  return state.key === key ? state : { layout: null, failed: false };
}
