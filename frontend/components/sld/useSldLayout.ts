"use client";
// Lays out the model once per topology (guideline §4.3): value edits keep the same key, so no re-layout.
import { useEffect, useState } from "react";
import type { SldModel } from "./buildSldModel";
import { layoutSld, type SldLayout } from "./layoutSld";

export function useSldLayout(model: SldModel): { layout: SldLayout | null; failed: boolean } {
  const [state, setState] = useState<{ key: string; layout: SldLayout | null; failed: boolean }>({ key: "", layout: null, failed: false });
  const key = model.topologyKey;
  useEffect(() => {
    let live = true;
    layoutSld(model).then(
      (layout) => live && setState({ key, layout, failed: false }),
      () => live && setState({ key, layout: null, failed: true }),
    );
    return () => {
      live = false;
    };
    // the model's values change without changing the layout; only the topology key re-runs it
  }, [key]);
  return state.key === key ? state : { layout: null, failed: false };
}
