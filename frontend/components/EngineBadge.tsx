"use client";
// Engine kind badge on every screen (Doc 7 P2): Fake results are never mistaken for real ones.
// Carbon Tag (guidelines §5): warm-gray for FAKE, cool-gray for REAL, red when the service is not
// reachable. The text stays "Engine: <kind>" (ADR-012 point 1).
import { Tag } from "@carbon/react";
import { useEffect, useState } from "react";
import { getMeta } from "../api-client";

const TYPE: Record<string, "warm-gray" | "cool-gray" | "red"> = { FAKE: "warm-gray", REAL: "cool-gray", unreachable: "red" };

export function EngineBadgeView({ kind }: { kind: string }) {
  return (
    <Tag type={TYPE[kind] ?? "cool-gray"} size="md" data-kind={kind} data-testid="engine-badge" title="Calculation engine">
      Engine: {kind}
    </Tag>
  );
}

export function EngineBadge() {
  const [kind, setKind] = useState<string>("…");
  useEffect(() => {
    void getMeta().then((r) => setKind(r.ok ? r.data.engine.engine_kind : "unreachable"));
  }, []);
  return <EngineBadgeView kind={kind} />;
}
