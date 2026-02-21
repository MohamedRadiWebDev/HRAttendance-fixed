import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type {
  Adjustment,
  AttendanceRecord,
  BiometricPunch,
  Employee,
  InsertAdjustment,
  InsertEmployee,
  InsertLeave,
  InsertOfficialHoliday,
  InsertSpecialRule,
  Leave,
  OfficialHoliday,
  SpecialRule,
} from "@shared/schema";
import { processAttendanceRecords } from "@/engine/attendanceEngine";
import { normalizeEmployeeCode } from "@shared/employee-code";
import { useEffectsStore } from "@/store/effectsStore";
import {
  clearPersistedState,
  deserializeAttendanceRecords,
  loadPersistedState,
  persistState,
} from "@/store/persistence";


const normalizeEmployeeTextDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\./g, "/");
  const iso = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dmy = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
};

const normalizeEmployeeRow = (row: Partial<InsertEmployee>) => ({
  ...row,
  section: String((row as any).section || (row as any).department || "").trim() || "غير مسجل",
  hireDate: normalizeEmployeeTextDate((row as any).hireDate ?? (row as any).hire_date ?? (row as any)["تاريخ التعيين"]),
});

const byCode = (employees: Employee[]) => new Map(employees.map((emp) => [emp.code, emp]));

type AttendanceState = {
  employees: Employee[];
  punches: BiometricPunch[];
  rules: SpecialRule[];
  adjustments: Adjustment[];
  leaves: Leave[];
  officialHolidays: OfficialHoliday[];
  attendanceRecords: AttendanceRecord[];
  config: {
    autoBackupEnabled: boolean;
    attendanceStartDate?: string | null;
    attendanceEndDate?: string | null;
    defaultPermissionMinutes: number;
    defaultHalfDayMinutes: number;
    defaultHalfDaySide: "صباح" | "مساء";
  };
  nextIds: {
    employee: number;
    rule: number;
    adjustment: number;
    leave: number;
    record: number;
  };
};

type AttendanceActions = {
  importEmployees: (rows: InsertEmployee[]) => { count: number };
  createEmployee: (row: InsertEmployee) => Employee;
  updateEmployee: (id: number, updates: Partial<InsertEmployee>) => Employee | null;
  importPunches: (rows: { employeeCode: string; punchDatetime: string }[]) => { count: number };
  createRule: (row: InsertSpecialRule) => SpecialRule;
  updateRule: (id: number, updates: Partial<InsertSpecialRule>) => SpecialRule | null;
  deleteRule: (id: number) => void;
  importRules: (rows: InsertSpecialRule[]) => { count: number };
  createAdjustment: (row: InsertAdjustment) => Adjustment;
  importAdjustments: (rows: InsertAdjustment[]) => { inserted: number; invalid: { rowIndex?: number; reason?: string }[] };
  createLeave: (row: InsertLeave) => Leave;
  deleteLeave: (id: number) => void;
  importLeaves: (rows: InsertLeave[]) => { inserted: number; invalid: { rowIndex?: number; reason?: string }[] };
  createOfficialHoliday: (row: InsertOfficialHoliday) => OfficialHoliday;
  deleteOfficialHoliday: (id: number) => void;
  setOfficialHolidays: (rows: OfficialHoliday[]) => void;
  processAttendance: (params: { startDate: string; endDate: string; timezoneOffsetMinutes?: number; employeeCodes?: string[] }) => {
    message: string;
    processedCount: number;
  };
  wipeData: () => void;
  setEmployees: (rows: Employee[]) => void;
  setPunches: (rows: BiometricPunch[]) => void;
  setRules: (rows: SpecialRule[]) => void;
  setLeaves: (rows: Leave[]) => void;
  setAdjustments: (rows: Adjustment[]) => void;
  setAttendanceRecords: (rows: AttendanceRecord[]) => void;
  updateAttendanceRecord: (id: number, updates: Partial<AttendanceRecord>) => void;
  setConfig: (config: AttendanceState["config"]) => void;
  getSnapshot: () => AttendanceState;
};

export type AttendanceStoreState = AttendanceState & AttendanceActions;

type SetStateAction = { type: "SET_STATE"; nextState: AttendanceState };

const initialState: AttendanceState = {
  employees: [],
  punches: [],
  rules: [],
  adjustments: [],
  leaves: [],
  officialHolidays: [],
  attendanceRecords: [],
  config: {
    autoBackupEnabled: false,
    attendanceStartDate: null,
    attendanceEndDate: null,
    defaultPermissionMinutes: 120,
    defaultHalfDayMinutes: 240,
    defaultHalfDaySide: "صباح",
  },
  nextIds: { employee: 1, rule: 1, adjustment: 1, leave: 1, record: 1 },
};

const reducer = (_state: AttendanceState, action: SetStateAction) => {
  if (action.type === "SET_STATE") return action.nextState;
  return _state;
};

const AttendanceStoreContext = createContext<AttendanceStoreState | null>(null);

export const AttendanceStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const persistenceTimerRef = useRef<number | null>(null);
  const hydrationRef = useRef(false);
  const hasHydratedRef = useRef(false);

  const setState = useCallback((nextState: AttendanceState) => {
    dispatch({ type: "SET_STATE", nextState });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (hydrationRef.current) return;
    hydrationRef.current = true;
    let isMounted = true;
    loadPersistedState()
      .then((result) => {
        if (!isMounted || result.status !== "ok" || !result.payload) return;
        const payload = result.payload;
        const hydratedState: AttendanceState = {
          ...initialState,
          ...payload.state,
          punches: payload.punches,
          attendanceRecords: deserializeAttendanceRecords(payload.state.attendanceRecords),
        };
        setState(hydratedState);
      })
      .catch(() => {
        // ignore load errors
      })
      .finally(() => {
        if (isMounted) hasHydratedRef.current = true;
      });
    return () => {
      isMounted = false;
    };
  }, [setState]);

  useEffect(() => {
    if (!state.config.autoBackupEnabled) return;
    const payload = {
      meta: {
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
        appVersion: "1.0.0",
        selectedModules: [
          "employees",
          "punches",
          "rules",
          "leaves",
          "adjustments",
          "officialHolidays",
          "attendanceRecords",
          "config",
        ],
        recordCounts: {
          employees: state.employees.length,
          punches: state.punches.length,
          rules: state.rules.length,
          leaves: state.leaves.length,
          adjustments: state.adjustments.length,
          officialHolidays: state.officialHolidays.length,
          attendanceRecords: state.attendanceRecords.length,
        },
      },
      modules: {
        employees: state.employees,
        punches: state.punches,
        rules: state.rules,
        leaves: state.leaves,
        adjustments: state.adjustments,
        officialHolidays: state.officialHolidays,
        attendanceRecords: state.attendanceRecords,
        config: state.config,
      },
    };
    try {
      localStorage.setItem("hr_attendance_auto_backup", JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [state]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (persistenceTimerRef.current) {
      window.clearTimeout(persistenceTimerRef.current);
    }
    persistenceTimerRef.current = window.setTimeout(() => {
      persistState(stateRef.current as any).catch(() => {
        // ignore persistence errors
      });
    }, 400);
    return () => {
      if (persistenceTimerRef.current) {
        window.clearTimeout(persistenceTimerRef.current);
      }
    };
  }, [state]);

  const actions = useMemo<AttendanceActions>(() => ({
    importEmployees: (rows) => {
      const current = stateRef.current;
      const existingMap = byCode(current.employees);
      const nextEmployees = [...current.employees];
      let inserted = 0;
      rows.forEach((row) => {
        const normalizedCode = normalizeEmployeeCode(row.code);
        if (!normalizedCode || existingMap.has(normalizedCode)) return;
        const employee: Employee = {
          id: current.nextIds.employee + inserted,
          ...normalizeEmployeeRow(row),
          code: normalizedCode,
          shiftStart: row.shiftStart || "09:00",
        } as Employee;
        nextEmployees.push(employee);
        existingMap.set(employee.code, employee);
        inserted += 1;
      });
      setState({
        ...current,
        employees: nextEmployees,
        nextIds: {
          ...current.nextIds,
          employee: current.nextIds.employee + inserted,
        },
      });
      return { count: inserted };
    },
    createEmployee: (row) => {
      const current = stateRef.current;
      const normalizedCode = normalizeEmployeeCode(row.code);
      if (current.employees.some((employee) => employee.code === normalizedCode)) {
        throw new Error("Employee code already exists");
      }
      const employee: Employee = {
        id: current.nextIds.employee,
        ...normalizeEmployeeRow(row),
        code: normalizedCode,
        shiftStart: row.shiftStart || "09:00",
      } as Employee;
      setState({
        ...current,
        employees: [...current.employees, employee],
        nextIds: { ...current.nextIds, employee: current.nextIds.employee + 1 },
      });
      return employee;
    },
    updateEmployee: (id, updates) => {
      const current = stateRef.current;
      let updatedEmployee: Employee | null = null;
      const employees = current.employees.map((employee) => {
        if (employee.id !== id) return employee;
        updatedEmployee = { ...employee, ...updates } as Employee;
        return updatedEmployee;
      });
      if (!updatedEmployee) return null;
      setState({ ...current, employees });
      return updatedEmployee;
    },
    importPunches: (rows) => {
      const current = stateRef.current;
      const nextPunches = [...current.punches];
      rows.forEach((row) => {
        const punchDatetime = new Date(row.punchDatetime);
        const employeeCode = normalizeEmployeeCode(row.employeeCode);
        if (!employeeCode || Number.isNaN(punchDatetime.getTime())) return;
        nextPunches.push({
          id: nextPunches.length + 1,
          employeeCode,
          punchDatetime,
        } as BiometricPunch);
      });
      setState({ ...current, punches: nextPunches });
      return { count: nextPunches.length - current.punches.length };
    },
    createRule: (row) => {
      const current = stateRef.current;
      const rule: SpecialRule = {
        id: current.nextIds.rule,
        ...row,
      } as SpecialRule;
      setState({
        ...current,
        rules: [...current.rules, rule],
        nextIds: { ...current.nextIds, rule: current.nextIds.rule + 1 },
      });
      return rule;
    },
    updateRule: (id, updates) => {
      const current = stateRef.current;
      let updatedRule: SpecialRule | null = null;
      const rules = current.rules.map((rule) => {
        if (rule.id !== id) return rule;
        updatedRule = { ...rule, ...updates } as SpecialRule;
        return updatedRule;
      });
      if (!updatedRule) return null;
      setState({ ...current, rules });
      return updatedRule;
    },
    deleteRule: (id) => {
      const current = stateRef.current;
      setState({ ...current, rules: current.rules.filter((rule) => rule.id !== id) });
    },
    importRules: (rows) => {
      const current = stateRef.current;
      let inserted = 0;
      const rules = [...current.rules];
      rows.forEach((row) => {
        const rule: SpecialRule = {
          id: current.nextIds.rule + inserted,
          ...row,
        } as SpecialRule;
        rules.push(rule);
        inserted += 1;
      });
      setState({
        ...current,
        rules,
        nextIds: { ...current.nextIds, rule: current.nextIds.rule + inserted },
      });
      return { count: inserted };
    },
    createAdjustment: (row) => {
      const current = stateRef.current;
      const adjustment: Adjustment = {
        id: current.nextIds.adjustment,
        ...row,
      } as Adjustment;
      setState({
        ...current,
        adjustments: [...current.adjustments, adjustment],
        nextIds: { ...current.nextIds, adjustment: current.nextIds.adjustment + 1 },
      });
      return adjustment;
    },
    importAdjustments: (rows) => {
      const current = stateRef.current;
      const adjustments = [...current.adjustments];
      let inserted = 0;
      rows.forEach((row) => {
        const adjustment: Adjustment = {
          id: current.nextIds.adjustment + inserted,
          ...row,
        } as Adjustment;
        adjustments.push(adjustment);
        inserted += 1;
      });
      setState({
        ...current,
        adjustments,
        nextIds: { ...current.nextIds, adjustment: current.nextIds.adjustment + inserted },
      });
      return { inserted, invalid: [] };
    },
    createLeave: (row) => {
      const current = stateRef.current;
      const leave: Leave = {
        id: current.nextIds.leave,
        ...row,
      } as Leave;
      setState({
        ...current,
        leaves: [...current.leaves, leave],
        nextIds: { ...current.nextIds, leave: current.nextIds.leave + 1 },
      });
      return leave;
    },
    deleteLeave: (id) => {
      const current = stateRef.current;
      setState({ ...current, leaves: current.leaves.filter((leave) => leave.id !== id) });
    },
    importLeaves: (rows) => {
      const current = stateRef.current;
      let inserted = 0;
      const leaves = [...current.leaves];
      rows.forEach((row) => {
        const leave: Leave = {
          id: current.nextIds.leave + inserted,
          ...row,
        } as Leave;
        leaves.push(leave);
        inserted += 1;
      });
      setState({
        ...current,
        leaves,
        nextIds: { ...current.nextIds, leave: current.nextIds.leave + inserted },
      });
      return { inserted, invalid: [] };
    },
    createOfficialHoliday: (row) => {
      const current = stateRef.current;
      const holiday: OfficialHoliday = {
        id: current.officialHolidays.length + 1,
        ...row,
      } as OfficialHoliday;
      setState({
        ...current,
        officialHolidays: [...current.officialHolidays, holiday],
      });
      return holiday;
    },
    deleteOfficialHoliday: (id) => {
      const current = stateRef.current;
      setState({ ...current, officialHolidays: current.officialHolidays.filter((holiday) => holiday.id !== id) });
    },
    processAttendance: ({ startDate, endDate, timezoneOffsetMinutes, employeeCodes }) => {
      const current = stateRef.current;
      const overrideMap = new Map<string, boolean>();
      current.attendanceRecords.forEach((record) => {
        if (record.workedOnOfficialHoliday === null || record.workedOnOfficialHoliday === undefined) return;
        overrideMap.set(`${record.employeeCode}__${record.date}`, record.workedOnOfficialHoliday);
      });
      const effects = useEffectsStore.getState().effects;
      const records = processAttendanceRecords({
        employees: current.employees,
        punches: current.punches,
        rules: current.rules,
        leaves: current.leaves,
        officialHolidays: current.officialHolidays,
        adjustments: current.adjustments,
        effects,
        startDate,
        endDate,
        timezoneOffsetMinutes,
        employeeCodes,
        workedOnOfficialHolidayOverrides: overrideMap,
        defaultPermissionMinutes: current.config.defaultPermissionMinutes,
        defaultHalfDayMinutes: current.config.defaultHalfDayMinutes,
      });

      const nextRecordIdStart = current.nextIds.record;
      const withIds = records.map((record, index) => ({
        ...record,
        id: nextRecordIdStart + index,
      }));

      const recordKey = (record: AttendanceRecord) => `${record.employeeCode}__${record.date}`;
      const remaining = current.attendanceRecords.filter((record) => {
        return !(record.date >= startDate && record.date <= endDate);
      });
      const merged = new Map<string, AttendanceRecord>();
      remaining.forEach((record) => merged.set(recordKey(record), record));
      withIds.forEach((record) => merged.set(recordKey(record), record));

      const updatedRecords = Array.from(merged.values());

      setState({
        ...current,
        attendanceRecords: updatedRecords,
        nextIds: { ...current.nextIds, record: nextRecordIdStart + withIds.length },
      });

      const employeeCount = employeeCodes?.length || current.employees.length;
      const daySpan = Math.max(1, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
      return { message: `تمت إعادة المعالجة: ${employeeCount} موظف / ${daySpan} يوم`, processedCount: withIds.length };
    },
    wipeData: () => {
      void clearPersistedState();
      setState({
        employees: [],
        punches: [],
        rules: [],
        adjustments: [],
        leaves: [],
        officialHolidays: [],
        attendanceRecords: [],
        config: {
          autoBackupEnabled: false,
          attendanceStartDate: null,
          attendanceEndDate: null,
          defaultPermissionMinutes: 120,
          defaultHalfDayMinutes: 240,
          defaultHalfDaySide: "صباح",
        },
        nextIds: { employee: 1, rule: 1, adjustment: 1, leave: 1, record: 1 },
      });
    },
    setEmployees: (rows) => {
      const current = stateRef.current;
      const maxId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0);
      setState({
        ...current,
        employees: rows,
        nextIds: { ...current.nextIds, employee: Math.max(current.nextIds.employee, maxId + 1) },
      });
    },
    setPunches: (rows) => {
      const current = stateRef.current;
      setState({ ...current, punches: rows });
    },
    setRules: (rows) => {
      const current = stateRef.current;
      const maxId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0);
      setState({
        ...current,
        rules: rows,
        nextIds: { ...current.nextIds, rule: Math.max(current.nextIds.rule, maxId + 1) },
      });
    },
    setLeaves: (rows) => {
      const current = stateRef.current;
      const maxId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0);
      setState({
        ...current,
        leaves: rows,
        nextIds: { ...current.nextIds, leave: Math.max(current.nextIds.leave, maxId + 1) },
      });
    },
    setOfficialHolidays: (rows) => {
      const current = stateRef.current;
      setState({ ...current, officialHolidays: rows });
    },
    setAdjustments: (rows) => {
      const current = stateRef.current;
      const maxId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0);
      setState({
        ...current,
        adjustments: rows,
        nextIds: { ...current.nextIds, adjustment: Math.max(current.nextIds.adjustment, maxId + 1) },
      });
    },
    setAttendanceRecords: (rows) => {
      const current = stateRef.current;
      const maxId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0);
      setState({
        ...current,
        attendanceRecords: rows,
        nextIds: { ...current.nextIds, record: Math.max(current.nextIds.record, maxId + 1) },
      });
    },
    updateAttendanceRecord: (id, updates) => {
      const current = stateRef.current;
      const attendanceRecords = current.attendanceRecords.map((record) => {
        if (record.id !== id) return record;
        return { ...record, ...updates } as AttendanceRecord;
      });
      setState({ ...current, attendanceRecords });
    },
    setConfig: (config) => {
      const current = stateRef.current;
      setState({ ...current, config });
    },
    getSnapshot: () => stateRef.current,
  }), [setState]);

  const value = useMemo(() => ({ ...state, ...actions }), [actions, state]);

  return <AttendanceStoreContext.Provider value={value}>{children}</AttendanceStoreContext.Provider>;
};

export const useAttendanceStore = <T,>(selector?: (state: AttendanceStoreState) => T) => {
  const context = useContext(AttendanceStoreContext);
  if (!context) {
    throw new Error("useAttendanceStore must be used within AttendanceStoreProvider");
  }
  return selector ? selector(context) : (context as T);
};
