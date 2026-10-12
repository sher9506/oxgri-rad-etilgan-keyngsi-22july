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

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}
