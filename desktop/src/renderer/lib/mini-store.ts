import { useSyncExternalStore } from 'react';

export function createStore<S>(initial: S) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<S> | ((s: S) => Partial<S>)) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); },
    use<T>(selector: (s: S) => T): T {
      return useSyncExternalStore(this.subscribe, () => selector(state));
    }
  };
}
