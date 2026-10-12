import { useSyncExternalStore } from 'react';

let tickMs = 0;
let listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size > 0 && !interval) {
    interval = setInterval(() => {
      tickMs = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

function getSnapshot(): number {
  if (tickMs === 0) {
    tickMs = Math.floor(Date.now() / 1000) * 1000;
  }
  return tickMs;
}

function getServerSnapshot(): number {
  return getSnapshot();
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tickMs = Date.now();
      listeners.forEach((l) => l());
    }
  });
}

const stepCache = new Map<number, { raw: number; floored: number }>();

function getSteppedSnapshot(stepMs: number): number {
  const raw = getSnapshot();
  const entry = stepCache.get(stepMs);
  if (entry && entry.raw === raw) return entry.floored;
  const floored = Math.floor(raw / stepMs) * stepMs;
  stepCache.set(stepMs, { raw, floored });
  return floored;
}

function makeSteppedSnapshotFn(stepMs: number): () => number {
  return () => getSteppedSnapshot(stepMs);
}

export function useNow(stepMs: number = 60_000): number {
  return useSyncExternalStore(
    subscribe,
    makeSteppedSnapshotFn(stepMs),
    getServerSnapshot,
  );
}
