import type {
  Adjustment,
  AttendanceRecord,
  BiometricPunch,
  Employee,
  Leave,
  SpecialRule,
} from "@shared/schema";
import { createZip, decodeText, encodeText, parseZip, type ZipInput } from "./zip";

export type BackupModuleKey =
  | "employees"
  | "punches"
  | "attendanceRecords"
  | "rules"
  | "leaves"
  | "adjustments"
  | "officialHolidays"
  | "config";

export type BackupMeta = {
  createdAt: string;
  appVersion: string;
  schemaVersion: number;
  selectedModules: BackupModuleKey[];
  recordCounts: Record<string, number>;
};

export type BackupPayload = {
  meta: BackupMeta;
  modules: {
    employees?: Employee[];
    punches?: Array<Omit<BiometricPunch, "punchDatetime"> & { punchDatetime: string }>;
    attendanceRecords?: AttendanceRecord[];
    rules?: SpecialRule[];
    leaves?: Leave[];
    adjustments?: Adjustment[];
    officialHolidays?: { id: number; date: string; name: string }[];
    config?: Record<string, unknown>;
  };
};

const toSerializablePunches = (punches: BiometricPunch[]) =>
  punches.map((punch) => ({
    ...punch,
    punchDatetime: punch.punchDatetime.toISOString(),
  }));

const fromSerializablePunches = (punches: Array<Omit<BiometricPunch, "punchDatetime"> & { punchDatetime: string }>) =>
  punches.map((punch) => ({
    ...punch,
    punchDatetime: new Date(punch.punchDatetime),
  })) as BiometricPunch[];

export const buildBackupPayload = (params: {
  state: {
    employees: Employee[];
    punches: BiometricPunch[];
    rules: SpecialRule[];
    leaves: Leave[];
    adjustments: Adjustment[];
    officialHolidays?: { id: number; date: string; name: string }[];
    attendanceRecords: AttendanceRecord[];
    config: Record<string, unknown>;
  };
  selectedModules: BackupModuleKey[];
}): BackupPayload => {
  const { state, selectedModules } = params;
  const modules: BackupPayload["modules"] = {};
  if (selectedModules.includes("employees")) modules.employees = state.employees;
  if (selectedModules.includes("punches")) modules.punches = toSerializablePunches(state.punches);
  if (selectedModules.includes("rules")) modules.rules = state.rules;
  if (selectedModules.includes("leaves")) modules.leaves = state.leaves;
  if (selectedModules.includes("adjustments")) modules.adjustments = state.adjustments;
  if (selectedModules.includes("officialHolidays")) modules.officialHolidays = state.officialHolidays || [];
  if (selectedModules.includes("attendanceRecords")) modules.attendanceRecords = state.attendanceRecords;
  if (selectedModules.includes("config")) modules.config = state.config;

  return {
    meta: {
      createdAt: new Date().toISOString(),
      appVersion: "1.0.0",
      schemaVersion: 1,
      selectedModules,
      recordCounts: {
        employees: state.employees.length,
        punches: state.punches.length,
        rules: state.rules.length,
        leaves: state.leaves.length,
        adjustments: state.adjustments.length,
        officialHolidays: state.officialHolidays?.length ?? 0,
        attendanceRecords: state.attendanceRecords.length,
      },
    },
    modules,
  };
};

export const createBackupZip = (payload: BackupPayload) => {
  const files: ZipInput[] = [];
  files.push({ name: "meta.json", data: encodeText(JSON.stringify(payload.meta, null, 2)) });
  if (payload.modules.employees) {
    files.push({ name: "employees.json", data: encodeText(JSON.stringify(payload.modules.employees, null, 2)) });
  }
  if (payload.modules.punches) {
    files.push({ name: "punches.json", data: encodeText(JSON.stringify(payload.modules.punches, null, 2)) });
  }
  if (payload.modules.rules) {
    files.push({ name: "rules.json", data: encodeText(JSON.stringify(payload.modules.rules, null, 2)) });
  }
  if (payload.modules.leaves) {
    files.push({ name: "leaves.json", data: encodeText(JSON.stringify(payload.modules.leaves, null, 2)) });
  }
  if (payload.modules.adjustments) {
    files.push({ name: "adjustments.json", data: encodeText(JSON.stringify(payload.modules.adjustments, null, 2)) });
  }
  if (payload.modules.officialHolidays) {
    files.push({ name: "officialHolidays.json", data: encodeText(JSON.stringify(payload.modules.officialHolidays, null, 2)) });
  }
  if (payload.modules.attendanceRecords) {
    files.push({ name: "attendanceRecords.json", data: encodeText(JSON.stringify(payload.modules.attendanceRecords, null, 2)) });
  }
  if (payload.modules.config) {
    files.push({ name: "config.json", data: encodeText(JSON.stringify(payload.modules.config, null, 2)) });
  }
  const zipData = createZip(files);
  return new Blob([zipData], { type: "application/zip" });
};

export const readBackupZip = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const files = parseZip(new Uint8Array(arrayBuffer));
  if (!files["meta.json"]) {
    throw new Error("ملف النسخة الاحتياطية لا يحتوي على meta.json.");
  }
  const meta = JSON.parse(decodeText(files["meta.json"])) as BackupMeta;
  if (meta.schemaVersion !== 1) {
    throw new Error("إصدار النسخة الاحتياطية غير مدعوم.");
  }

  const modules: BackupPayload["modules"] = {};
  if (files["employees.json"]) modules.employees = JSON.parse(decodeText(files["employees.json"]));
  if (files["punches.json"]) modules.punches = JSON.parse(decodeText(files["punches.json"]));
  if (files["rules.json"]) modules.rules = JSON.parse(decodeText(files["rules.json"]));
  if (files["leaves.json"]) modules.leaves = JSON.parse(decodeText(files["leaves.json"]));
  if (files["adjustments.json"]) modules.adjustments = JSON.parse(decodeText(files["adjustments.json"]));
  if (files["officialHolidays.json"]) modules.officialHolidays = JSON.parse(decodeText(files["officialHolidays.json"]));
  if (files["attendanceRecords.json"]) modules.attendanceRecords = JSON.parse(decodeText(files["attendanceRecords.json"]));
  if (files["config.json"]) modules.config = JSON.parse(decodeText(files["config.json"]));

  return { meta, modules };
};

export const restoreSerializablePunches = (punches?: BackupPayload["modules"]["punches"]) => {
  if (!punches) return [];
  return fromSerializablePunches(punches);
};

export const restoreAttendanceRecords = (records?: BackupPayload["modules"]["attendanceRecords"]) => {
  if (!records) return [];
  return records.map((record) => ({
    ...record,
    checkIn: record.checkIn ? new Date(record.checkIn) : null,
    checkOut: record.checkOut ? new Date(record.checkOut) : null,
  })) as AttendanceRecord[];
};
