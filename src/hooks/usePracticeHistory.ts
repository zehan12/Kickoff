"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { HistoryEntry } from "@/lib/types";

const STORAGE_KEY = "kickoff.history.v1";
const EMPTY: HistoryEntry[] = [];
const listeners = new Set<() => void>();
let snapshot: HistoryEntry[] = EMPTY;

function emit() {
  for (const listener of listeners) listener();
}

function readStorage(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    snapshot = readStorage();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY;
}

function write(next: HistoryEntry[]) {
  snapshot = next.length === 0 ? EMPTY : next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  emit();
}

export function usePracticeHistory() {
  const entries = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const addEntry = useCallback((entry: HistoryEntry) => {
    write([entry, ...snapshot].slice(0, 50));
  }, []);

  const rateEntry = useCallback((id: string, rating: number) => {
    write(
      snapshot.map((entry) => (entry.id === id ? { ...entry, rating } : entry))
    );
  }, []);

  const clear = useCallback(() => write(EMPTY), []);

  const rated = entries.filter((entry) => typeof entry.rating === "number");
  const average =
    rated.length === 0
      ? null
      : rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) /
        rated.length;

  return { entries, addEntry, rateEntry, clear, average };
}
