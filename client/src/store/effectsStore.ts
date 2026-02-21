import { create } from "zustand";
import { normalizeEmployeeCode } from "@shared/employee-code";
import { normalizeEffectDateKey, normalizeEffectTimeKey, normalizeEffectType } from "@shared/effect-normalization";
import { useEffectsHistoryStore } from "@/store/effectsHistoryStore";

export type EffectSource = "manual" | "excel";

export type Effect = {
  id: string;
  employeeCode: string;
  employeeName?: string;
  date: string;
  fromTime?: string;
  toTime?: string;
  type: string;
  status?: string;
  note?: string;
  source: EffectSource;
  createdAt: string;
  updatedAt: string;
};

type EffectsState = {
  effects: Effect[];
  setEffects: (rows: Effect[]) => void;
  upsertEffects: (rows: Omit<Effect, "id" | "createdAt" | "updatedAt">[]) => { inserted: number; updated: number; total: number };
  updateEffect: (id: string, patch: Partial<Effect>) => void;
  clearEffects: () => void;
  removeEffect: (id: string) => void;
};

const STORAGE_KEY = "hr_effects_v2";

const effectKey = (row: Pick<Effect, "employeeCode" | "date" | "type" | "fromTime" | "toTime">) =>
  `${normalizeEmployeeCode(row.employeeCode)}|${row.date}|${String(row.type || "").trim()}|${row.fromTime || ""}|${row.toTime || ""}`;

const toTimeValue = (value: unknown) => String(value || "").trim();

const migrateEffect = (row: any): Effect | null => {
  if (!row) return null;
  const employeeCode = normalizeEmployeeCode(row.employeeCode || "");
  const date = normalizeEffectDateKey(row.date);
  const type = normalizeEffectType(row.type);
  if (!employeeCode || !date || !type) return null;
  const now = new Date().toISOString();
  return {
    id: String(row.id || crypto.randomUUID()),
    employeeCode,
    employeeName: row.employeeName ? String(row.employeeName) : undefined,
    date,
    fromTime: normalizeEffectTimeKey(toTimeValue(row.fromTime ?? row.from)),
    toTime: normalizeEffectTimeKey(toTimeValue(row.toTime ?? row.to)),
    type,
    status: row.status ? String(row.status) : undefined,
    note: row.note ? String(row.note) : undefined,
    source: row.source === "manual" ? "manual" : "excel",
    createdAt: String(row.createdAt || now),
    updatedAt: String(row.updatedAt || row.createdAt || now),
  };
};

const loadEffects = (): Effect[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("hr_effects_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const rows = parsed.map(migrateEffect).filter(Boolean) as Effect[];
    return rows;
  } catch {
    return [];
  }
};

const persistEffects = (effects: Effect[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(effects));
};

export const useEffectsStore = create<EffectsState>((set) => ({
  effects: loadEffects(),
  setEffects: (rows) => {
    const current = useEffectsStore.getState().effects;
    if (current.length) useEffectsHistoryStore.getState().capture(current);
    const migrated = rows.map(migrateEffect).filter(Boolean) as Effect[];
    persistEffects(migrated);
    set({ effects: migrated });
  },
  upsertEffects: (rows) => {
    let stats = { inserted: 0, updated: 0, total: 0 };
    set((state) => {
      if (state.effects.length) useEffectsHistoryStore.getState().capture(state.effects);
      const now = new Date().toISOString();
      const keyToId = new Map<string, string>();
      const idToRow = new Map<string, Effect>();
      state.effects.forEach((effect) => {
        keyToId.set(effectKey(effect), effect.id);
        idToRow.set(effect.id, effect);
      });

      rows.forEach((row) => {
        const normalizedRow = migrateEffect({ ...row, id: undefined, createdAt: now, updatedAt: now });
        if (!normalizedRow) return;
        const key = effectKey(normalizedRow);
        const existingId = keyToId.get(key);
        if (existingId && idToRow.has(existingId)) {
          const old = idToRow.get(existingId)!;
          idToRow.set(existingId, {
            ...old,
            employeeName: normalizedRow.employeeName || old.employeeName,
            status: normalizedRow.status,
            note: normalizedRow.note,
            source: normalizedRow.source,
            updatedAt: now,
          });
          stats.updated += 1;
        } else {
          const created: Effect = {
            ...normalizedRow,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          keyToId.set(key, created.id);
          idToRow.set(created.id, created);
          stats.inserted += 1;
        }
      });

      const next = Array.from(idToRow.values()).sort((a, b) => a.date.localeCompare(b.date) || a.employeeCode.localeCompare(b.employeeCode));
      persistEffects(next);
      stats.total = next.length;
      return { effects: next };
    });

    return stats;
  },
  updateEffect: (id, patch) =>
    set((state) => {
      if (state.effects.length) useEffectsHistoryStore.getState().capture(state.effects);
      const now = new Date().toISOString();
      const next = state.effects.map((row) => {
        if (row.id !== id) return row;
        const updated = migrateEffect({ ...row, ...patch, id: row.id, createdAt: row.createdAt, updatedAt: now }) || row;
        return { ...updated, id: row.id, createdAt: row.createdAt, updatedAt: now };
      });
      persistEffects(next);
      return { effects: next };
    }),
  clearEffects: () => {
    const current = useEffectsStore.getState().effects;
    if (current.length) useEffectsHistoryStore.getState().capture(current);
    persistEffects([]);
    set({ effects: [] });
  },
  removeEffect: (id) =>
    set((state) => {
      if (state.effects.length) useEffectsHistoryStore.getState().capture(state.effects);
      const next = state.effects.filter((row) => row.id !== id);
      persistEffects(next);
      return { effects: next };
    }),
}));
