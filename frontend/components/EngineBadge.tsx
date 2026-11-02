"use client";
// Engine kind badge on every screen (Doc 7 P2): Fake results are never mistaken for real ones.
import { useEffect, useState } from "react";
import { getMeta } from "../api-client";

export function EngineBadge() {
  const [kind, setKind] = useState<string>("…");
  useEffect(() => {
    void getMeta().then((r) => setKind(r.ok ? r.data.engine.engine_kind : "unreachable"));
  }, []);
  return (
    <span className={`engine-badge engine-${kind}`} data-testid="engine-badge" title="Calculation engine">
      Engine: {kind}
    </span>
  );
}
