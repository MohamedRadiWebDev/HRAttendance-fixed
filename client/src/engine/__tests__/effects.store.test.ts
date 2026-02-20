import { beforeEach, describe, expect, it, vi } from "vitest";

const createStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const seed = {
  employeeCode: "101",
  employeeName: "Ahmed",
  date: "2024-06-01",
  fromTime: "09:00:00",
  toTime: "11:00:00",
  type: "إذن صباحي",
  status: "موافق",
  note: "test",
  source: "excel" as const,
};

describe("effects store persistence", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: createStorage() },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: (globalThis as any).window.localStorage,
      configurable: true,
      writable: true,
    });
    (globalThis as any).localStorage.clear();
    vi.resetModules();
  });

  it("rehydrates saved effects after module reload", async () => {
    const first = await import("@/store/effectsStore");
    first.useEffectsStore.getState().upsertEffects([seed]);
    expect(first.useEffectsStore.getState().effects.length).toBe(1);

    vi.resetModules();
    const second = await import("@/store/effectsStore");
    const restored = second.useEffectsStore.getState().effects;

    expect(restored.length).toBe(1);
    expect(restored[0].employeeCode).toBe(seed.employeeCode);
    expect(restored[0].type).toBe("اذن صباحي");
    expect(restored[0].fromTime).toBe("09:00");
  });
});
