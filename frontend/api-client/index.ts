// Thin HTTP wrapper over the local API (Doc 6). The only module that calls fetch().
import type {
  AnalysisRequestBody,
  AnalysisResponse,
  AnalysisType,
  ImportResponse,
  MetaInfo,
  RerunResponse,
  ValidateRequest,
  ValidationReport,
  VerifyResponse,
} from "../api-types";

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

export function validateProject(body: ValidateRequest): Promise<ApiOutcome<ValidationReport>> {
  return call<ValidationReport>("/api/projects/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

// The server stores nothing; it checks the file and returns it (Doc 6 §3.6).
export function importProject(file: unknown): Promise<ApiOutcome<ImportResponse>> {
  return call<ImportResponse>("/api/projects/import", post(file));
}

export function verifyRunRecord(record: unknown): Promise<ApiOutcome<VerifyResponse>> {
  return call<VerifyResponse>("/api/run-records/verify", post({ run_record: record }));
}

export function rerunRunRecord(record: unknown): Promise<ApiOutcome<RerunResponse>> {
  return call<RerunResponse>("/api/run-records/rerun", post({ run_record: record }));
}
