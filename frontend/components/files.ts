// Browser file helpers: download one JSON document (FR-49), read one chosen file as JSON.
export function downloadJson(fileName: string, doc: unknown): void {
  downloadText(fileName, JSON.stringify(doc, null, 2), "application/json");
}

export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// null when the file is not JSON; the server judges everything else (Doc 6 §3.5-3.6).
export async function readJson(file: File): Promise<{ doc: unknown } | null> {
  try {
    return { doc: JSON.parse(await file.text()) as unknown };
  } catch {
    return null;
  }
}

export const NOT_JSON = "This file is not a JSON document. Nothing was loaded.";
