import { create } from "zustand";

import type { Effect } from "@/store/effectsStore";
import { useEffectsStore } from "@/store/effectsStore";

type EffectsHistoryState = {
  past: Effect[][];
  future: Effect[][];
  limit: number;

  /** Capture a snapshot of current effects BEFORE applying a change. */
  capture: (snapshot: Effect[]) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
};

const clone = (rows: Effect[]) => rows.map((r) => ({ ...r }));

export const useEffectsHistoryStore = create<EffectsHistoryState>((set, get) => ({
  past: [],
  future: [],
  limit: 20,

  capture: (snapshot) => {
    set((state) => {
      const nextPast = [...state.past, clone(snapshot)];
      const trimmedPast = nextPast.length > state.limit ? nextPast.slice(nextPast.length - state.limit) : nextPast;
      return { past: trimmedPast, future: [] };
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    const { past, future } = get();
    if (!past.length) return;
    const current = useEffectsStore.getState().effects;
    const previous = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [clone(current), ...future] });
    useEffectsStore.getState().setEffects(previous);
  },

  redo: () => {
    const { past, future } = get();
    if (!future.length) return;
    const current = useEffectsStore.getState().effects;
    const next = future[0];
    set({ past: [...past, clone(current)], future: future.slice(1) });
    useEffectsStore.getState().setEffects(next);
  },

  clear: () => set({ past: [], future: [] }),
}));
