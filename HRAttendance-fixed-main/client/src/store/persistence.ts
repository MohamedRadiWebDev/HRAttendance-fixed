import type { AttendanceRecord, BiometricPunch, OfficialHoliday } from "@shared/schema";
import type { AttendanceStoreState } from "@/store/attendanceStore";

const STORAGE_KEY = "hr_attendance_state_v1";
const PUNCHES_STORAGE_KEY = "hr_attendance_punches_v1";
const LAST_SAVED_KEY = "hr_attendance_last_saved_at";
const AUTO_BACKUP_KEY = "hr_attendance_auto_backup";
const ATTENDANCE_START_KEY = "attendanceStartDate";
const ATTENDANCE_END_KEY = "attendanceEndDate";

const DB_NAME = "hr_attendance";
const DB_VERSION = 1;
const PUNCHES_STORE = "punches";
const PUNCHES_INDEX = "punchDatetime";

const STORAGE_SCHEMA_VERSION = 1;

type PersistedAttendanceRecord = Omit<AttendanceRecord, "checkIn" | "checkOut"> & {
  checkIn: string | null;
  checkOut: string | null;
};

type PersistedState = {
  schemaVersion: number;
  savedAt: string;
  state: {
    employees: AttendanceStoreState["employees"];
    rules: AttendanceStoreState["rules"];
    adjustments: AttendanceStoreState["adjustments"];
    leaves: AttendanceStoreState["leaves"];
    officialHolidays: OfficialHoliday[];
    attendanceRecords: PersistedAttendanceRecord[];
    config: AttendanceStoreState["config"];
    nextIds: AttendanceStoreState["nextIds"];
  };
};

type StoredPunch = {
  key: string;
  employeeCode: string;
  punchDatetime: string;
};

type CompatibilityStatus = {
  status: "ok" | "none" | "incompatible";
  reason?: string;
};

const dispatchPersistenceEvent = (type: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(type, { detail }));
};


const migratePersistedState = (raw: any): PersistedState | null => {
  if (!raw || typeof raw !== "object") return null;
  if (raw.schemaVersion === STORAGE_SCHEMA_VERSION && raw.state) return raw as PersistedState;

  // Legacy shape fallback: assume payload without schemaVersion
  if (raw.state && typeof raw.state === "object") {
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      savedAt: String(raw.savedAt || new Date().toISOString()),
      state: {
        employees: raw.state.employees || [],
        rules: raw.state.rules || [],
        adjustments: raw.state.adjustments || [],
        leaves: raw.state.leaves || [],
        officialHolidays: raw.state.officialHolidays || [],
        attendanceRecords: raw.state.attendanceRecords || [],
        config: raw.state.config || {
          autoBackupEnabled: false,
          attendanceStartDate: null,
          attendanceEndDate: null,
          defaultPermissionMinutes: 120,
          defaultHalfDayMinutes: 240,
          defaultHalfDaySide: "صباح",
        },
        nextIds: raw.state.nextIds || { employee: 1, rule: 1, adjustment: 1, leave: 1, record: 1 },
      },
    };
  }
  return null;
};
const isQuotaError = (error: unknown) => {
  if (!(error instanceof DOMException)) return false;
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22;
};

const toStoredPunch = (punch: BiometricPunch): StoredPunch => {
  const punchDatetime = punch.punchDatetime.toISOString();
  return {
    key: `${punch.employeeCode}__${punchDatetime}`,
    employeeCode: punch.employeeCode,
    punchDatetime,
  };
};

const fromStoredPunch = (punch: StoredPunch): BiometricPunch => ({
  id: 0,
  employeeCode: punch.employeeCode,
  punchDatetime: new Date(punch.punchDatetime),
});

const toPersistedRecords = (records: AttendanceRecord[]): PersistedAttendanceRecord[] =>
  records.map((record) => ({
    ...record,
    checkIn: record.checkIn ? record.checkIn.toISOString() : null,
    checkOut: record.checkOut ? record.checkOut.toISOString() : null,
  }));

const fromPersistedRecords = (records?: PersistedAttendanceRecord[]): AttendanceRecord[] =>
  (records || []).map((record) => ({
    ...record,
    checkIn: record.checkIn ? new Date(record.checkIn) : null,
    checkOut: record.checkOut ? new Date(record.checkOut) : null,
  }));

const openPunchesDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PUNCHES_STORE)) {
        const store = db.createObjectStore(PUNCHES_STORE, { keyPath: "key" });
        store.createIndex(PUNCHES_INDEX, "punchDatetime", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });

const runTransaction = <T,>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
) =>
  new Promise<T>((resolve, reject) => {
    const tx = db.transaction(PUNCHES_STORE, mode);
    const store = tx.objectStore(PUNCHES_STORE);
    let request: IDBRequest<T> | undefined;
    try {
      const result = action(store);
      if (result) request = result;
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve((request?.result as T) ?? (undefined as T));
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });

const savePunchesToIndexedDb = async (punches: BiometricPunch[]) => {
  const db = await openPunchesDb();
  await runTransaction(db, "readwrite", (store) => {
    store.clear();
    punches.forEach((punch) => {
      store.put(toStoredPunch(punch));
    });
  });
  db.close();
};

const loadPunchesFromIndexedDb = async (): Promise<BiometricPunch[]> => {
  const db = await openPunchesDb();
  const records = await runTransaction<StoredPunch[]>(db, "readonly", (store) => store.getAll());
  db.close();
  return (records || []).map(fromStoredPunch);
};

const clearPunchesFromIndexedDb = async () => {
  const db = await openPunchesDb();
  await runTransaction(db, "readwrite", (store) => store.clear());
  db.close();
};

const loadPunchesFromLocalStorage = (): BiometricPunch[] => {
  const raw = localStorage.getItem(PUNCHES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const stored = JSON.parse(raw) as StoredPunch[];
    return stored.map(fromStoredPunch);
  } catch {
    return [];
  }
};

const savePunchesToLocalStorage = (punches: BiometricPunch[]) => {
  const serialized = JSON.stringify(punches.map(toStoredPunch));
  const approxSize = serialized.length;
  if (approxSize > 4_000_000) {
    dispatchPersistenceEvent("attendance:persistence-error", {
      type: "quota",
      message: "مساحة التخزين غير كافية لحفظ سجلات البصمة محلياً.",
    });
    return;
  }
  localStorage.setItem(PUNCHES_STORAGE_KEY, serialized);
};

export const getStorageCompatibility = (): CompatibilityStatus => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { status: "none" };
  try {
    const parsed = JSON.parse(raw);
    const migrated = migratePersistedState(parsed);
    if (!migrated) {
      return { status: "incompatible", reason: "schema" };
    }
    return { status: "ok" };
  } catch {
    return { status: "incompatible", reason: "parse" };
  }
};

export const loadPersistedState = async () => {
  const compatibility = getStorageCompatibility();
  if (compatibility.status === "incompatible") {
    dispatchPersistenceEvent("attendance:persistence-incompatible", {
      reason: compatibility.reason,
    });
    return { status: "incompatible" as const, payload: null };
  }

  if (compatibility.status === "none") {
    return { status: "none" as const, payload: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "none" as const, payload: null };
    const parsed = migratePersistedState(JSON.parse(raw));
    if (!parsed) return { status: "incompatible" as const, payload: null };

    const punches = await (async () => {
      try {
        return await loadPunchesFromIndexedDb();
      } catch {
        return loadPunchesFromLocalStorage();
      }
    })();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

    return {
      status: "ok" as const,
      payload: {
        state: parsed.state,
        punches,
        savedAt: parsed.savedAt,
      },
    };
  } catch (error) {
    dispatchPersistenceEvent("attendance:persistence-incompatible", { reason: "parse" });
    return { status: "incompatible" as const, payload: null };
  }
};

export const persistState = async (state: AttendanceStoreState) => {
  const payload: PersistedState = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    state: {
      employees: state.employees,
      rules: state.rules,
      adjustments: state.adjustments,
      leaves: state.leaves,
      officialHolidays: state.officialHolidays,
      attendanceRecords: toPersistedRecords(state.attendanceRecords),
      config: state.config,
      nextIds: state.nextIds,
    },
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(LAST_SAVED_KEY, payload.savedAt);
  } catch (error) {
    if (isQuotaError(error)) {
      dispatchPersistenceEvent("attendance:persistence-error", {
        type: "quota",
        message: "مساحة التخزين غير كافية لحفظ البيانات.",
      });
    }
    return;
  }

  try {
    await savePunchesToIndexedDb(state.punches);
  } catch (error) {
    try {
      savePunchesToLocalStorage(state.punches);
    } catch (fallbackError) {
      if (isQuotaError(fallbackError)) {
        dispatchPersistenceEvent("attendance:persistence-error", {
          type: "quota",
          message: "مساحة التخزين غير كافية لحفظ سجلات البصمة.",
        });
      }
    }
  }

  dispatchPersistenceEvent("attendance:persistence-saved", { savedAt: payload.savedAt });
};

export const clearPersistedState = async () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PUNCHES_STORAGE_KEY);
  localStorage.removeItem(LAST_SAVED_KEY);
  localStorage.removeItem(AUTO_BACKUP_KEY);
  localStorage.removeItem(ATTENDANCE_START_KEY);
  localStorage.removeItem(ATTENDANCE_END_KEY);
  try {
    await clearPunchesFromIndexedDb();
  } catch {
    // ignore
  }
};

export const getLastSavedAt = () => localStorage.getItem(LAST_SAVED_KEY);

export const exportIncompatibleBackup = async () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  const punches = await (async () => {
    try {
      return await loadPunchesFromIndexedDb();
    } catch {
      return loadPunchesFromLocalStorage();
    }
  })();
  const payload = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    rawState: raw,
    punches: punches.map(toStoredPunch),
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
};

export const deserializeAttendanceRecords = (records?: PersistedAttendanceRecord[]) =>
  fromPersistedRecords(records);

export const loadPunchesByDateRange = async (start: string, end: string) => {
  const startKey = new Date(start).toISOString();
  const endKey = new Date(end).toISOString();
  try {
    const db = await openPunchesDb();
    const result = await runTransaction<StoredPunch[]>(db, "readonly", (store) => {
      const index = store.index(PUNCHES_INDEX);
      return index.getAll(IDBKeyRange.bound(startKey, endKey));
    });
    db.close();
    return (result || []).map(fromStoredPunch);
  } catch {
    return loadPunchesFromLocalStorage().filter((punch) => {
      const iso = punch.punchDatetime.toISOString();
      return iso >= startKey && iso <= endKey;
    });
  }
};
