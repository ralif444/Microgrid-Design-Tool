"use client";
// Study inputs kept across navigation (audit 2026-11-15 O4): a drop-in for useState whose value
// survives leaving and re-opening a screen. Memory only, per Project and screen: a reload, another
// Project or closing the tab starts empty again, and nothing goes into the Project file.
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useProject } from "../store";

const kept = new Map<string, unknown>();

export const keptKey = (projectId: string | undefined, path: string, key: string) => `${projectId ?? ""}|${path}|${key}`;

/** The kept value for `k`, else the initial value. */
export function keptOr<T>(k: string, init: T | (() => T)): T {
  if (kept.has(k)) return kept.get(k) as T;
  return typeof init === "function" ? (init as () => T)() : init;
}

export const keep = (k: string, v: unknown) => void kept.set(k, v);

export function useKept<T>(key: string, init: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const k = keptKey(useProject().project?.id, usePathname(), key);
  const [s, setS] = useState(() => ({ k, v: keptOr(k, init) }));
  // the key changed while mounted (another Project, a new run behind the example form): take that key's value,
  // never carry the old one over to it
  const cur = s.k === k ? s : { k, v: keptOr(k, init) };
  if (cur !== s) setS(cur);
  useEffect(() => keep(cur.k, cur.v), [cur.k, cur.v]);
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (a) => setS((p) => ({ k: p.k, v: typeof a === "function" ? (a as (x: T) => T)(p.v) : a })),
    [],
  );
  return [cur.v, set];
}
