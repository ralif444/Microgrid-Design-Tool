// Thin HTTP wrapper over the local API (Doc 6). The only module that calls fetch().
import type { AnalysisRequestBody, AnalysisResponse, AnalysisType, MetaInfo } from "../api-types";

export type ApiOutcome<T> = { ok: true; data: T } | { ok: false; message: string };

const TRANSPORT_MESSAGE = "The local service did not answer correctly";

async function call<T>(path: string, init?: RequestInit): Promise<ApiOutcome<T>> {
  try {
    const res = await fetch(path, init);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, message: `${TRANSPORT_MESSAGE} (HTTP ${res.status}${body?.message ? `: ${body.message}` : ""})` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, message: TRANSPORT_MESSAGE };
  }
}

export function getMeta(): Promise<ApiOutcome<MetaInfo>> {
  return call<MetaInfo>("/api/meta");
}

export function runAnalysis(
  type: AnalysisType,
  body: AnalysisRequestBody,
): Promise<ApiOutcome<AnalysisResponse>> {
  return call<AnalysisResponse>(`/api/analyses/${type}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
