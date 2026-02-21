import type { AttendanceRecord, Employee } from "@shared/schema";
import { parseTimeToSeconds } from "@/lib/datetime";
import { normalizeEmployeeCode } from "@shared/employee-code";

const dayNames = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

export const DETAIL_HEADERS = [
  "التاريخ",
  "اليوم",
  "الكود",
  "اسم الموظف",
  "القسم",
  "تاريخ التعيين",
  "تاريخ ترك العمل",
  "فترة الالتحاق",
  "فترة الترك",
  "الدخول",
  "الخروج",
  "ساعات العمل",
  "الإضافي",
  "نوع اليوم",
  "الحالة",
  "تأخير",
  "انصراف مبكر",
  "سهو بصمة",
  "غياب",
  "إجمالي الجزاءات",
  "ملاحظات",
  "مدير الإدارة",
  "إجمالي الإضافي",
] as const;

export const SUMMARY_HEADERS = [
  "الكود",
  "اسم الموظف",
  "القسم",
  "تاريخ التعيين",
  "تاريخ ترك العمل",
  "فترة الالتحاق",
  "فترة الترك",
  "بدل يوم الجمع",
  "بدل أيام الإجازات الرسمية",
  "إجمالي أيام البدل",
  "إجمالي التأخيرات",
  "إجمالي الانصراف المبكر",
  "إجمالي سهو البصمة",
  "إجمالي الغياب",
  "إجمالي الجزاءات",
  "ملاحظات",
  "مدير الإدارة",
  "إجمالي الإضافي",
] as const;

const toExcelDateSerial = (value: string) => {
  const [yearRaw, monthRaw, dayRaw] = value.split("-").map(Number);
  if (!Number.isFinite(yearRaw) || !Number.isFinite(monthRaw) || !Number.isFinite(dayRaw)) return "";
  return (Date.UTC(yearRaw, monthRaw - 1, dayRaw) - Date.UTC(1899, 11, 30)) / 86400000;
};

const excelSerialToIsoDate = (serial: number): string => {
  if (!Number.isFinite(serial)) return "";
  const wholeDays = Math.floor(serial);
  const ms = wholeDays * 86400000;
  const date = new Date(Date.UTC(1899, 11, 30) + ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const normalizeDateText = (value: unknown): string => {
  if (typeof value === "number") return excelSerialToIsoDate(value);
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

const parseIsoDateToUtcMs = (value: string): number | null => {
  const [y, m, d] = value.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Date.UTC(y, m - 1, d);
};

const arabicDayName = (isoDate: string) => {
  const ms = parseIsoDateToUtcMs(isoDate);
  if (ms === null) return "";
  return dayNames[new Date(ms).getUTCDay()] || "";
};

const toTimeText = (value: unknown) => {
  if (!value) return "";
  if (value instanceof Date) {
    const h = String(value.getHours()).padStart(2, "0");
    const m = String(value.getMinutes()).padStart(2, "0");
    const s = String(value.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  const text = String(value);
  if (text.includes("T")) return text.split("T")[1].slice(0, 8);
  return text.slice(0, 8);
};

const cleanNotes = (value: string | null | undefined) => {
  const note = String(value || "").replace(/[\r\n]+/g, " ").trim();
  if (!note) return "";
  if (/^Shift\s+\d{1,2}:\d{2}-\d{1,2}:\d{2}/i.test(note)) return "";
  return note;
};

export const calculateOnboardingDays = (hireDate: string, reportStartDate: string, reportEndDate?: string): number => {
  if (!hireDate || !reportStartDate) return 0;
  const hireMs = parseIsoDateToUtcMs(hireDate);
  const startMs = parseIsoDateToUtcMs(reportStartDate);
  if (hireMs === null || startMs === null) return 0;
  if (hireMs <= startMs) return 0;
  const raw = Math.floor((hireMs - startMs) / 86400000);
  if (!reportEndDate) return Math.max(0, raw);
  const endMs = parseIsoDateToUtcMs(reportEndDate);
  if (endMs === null || endMs < startMs) return Math.max(0, raw);
  const rangeDays = Math.floor((endMs - startMs) / 86400000) + 1;
  return Math.max(0, Math.min(raw, rangeDays));
};

export const calculateTerminationPeriodDays = (terminationDate: string, reportEndDate: string): number => {
  if (!terminationDate || !reportEndDate) return 0;
  const terminationMs = parseIsoDateToUtcMs(terminationDate);
  const endMs = parseIsoDateToUtcMs(reportEndDate);
  if (terminationMs === null || endMs === null) return 0;
  if (terminationMs >= endMs) return 0;
  return Math.max(0, Math.floor((endMs - terminationMs) / 86400000));
};

export type AttendanceExportResult = {
  detailHeaders: string[];
  detailRows: any[][];
  summaryHeaders: string[];
  summaryRows: any[][];
};

const mapRowsByHeaders = (headers: readonly string[], rows: Record<string, any>[]) => [
  [...headers],
  ...rows.map((row) => headers.map((header) => row[header] ?? "")),
];

const buildEmployeeMeta = (employee?: Employee) => {
  const hireDate = normalizeDateText((employee as any)?.hireDate ?? (employee as any)?.hire_date ?? (employee as any)?.["تاريخ التعيين"]);
  const terminationDate = normalizeDateText((employee as any)?.terminationDate ?? (employee as any)?.termination_date ?? (employee as any)?.["تاريخ ترك العمل"]);
  return {
    name: String(employee?.nameAr || "").trim() || "(غير موجود بالماستر)",
    department: String((employee as any)?.section || (employee as any)?.department || "").trim() || "غير مسجل",
    manager: String((employee as any)?.deptManager || (employee as any)?.directManager || "").trim(),
    hireDate,
    terminationDate,
    hireDateSerial: hireDate ? toExcelDateSerial(hireDate) : "",
    terminationDateSerial: terminationDate ? toExcelDateSerial(terminationDate) : "",
  };
};

export const buildAttendanceExportRows = ({
  records,
  employees,
  reportStartDate,
  reportEndDate,
}: {
  records: AttendanceRecord[];
  employees: Employee[];
  reportStartDate?: string;
  reportEndDate?: string;
}): AttendanceExportResult => {
  const employeeMetaMap = new Map(employees.map((emp) => [normalizeEmployeeCode(emp.code), buildEmployeeMeta(emp)]));
  const effectiveReportStartDate = reportStartDate || (records.map((r) => String(r.date || "")).filter(Boolean).sort()[0] || "");
  const effectiveReportEndDate = reportEndDate || (records.map((r) => String(r.date || "")).filter(Boolean).sort().at(-1) || "");

  const detailObjects: Record<string, any>[] = [];
  const summaryByEmployee = new Map<string, {
    code: string;
    name: string;
    department: string;
    manager: string;
    hireDateSerial: string | number;
    terminationDateSerial: string | number;
    onboardingDays: number;
    terminationPeriodDays: number;
    compDaysFriday: number;
    compDaysOfficial: number;
    late: number;
    early: number;
    missing: number;
    absenceDays: number;
    overtimeHours: number;
    notes: string;
  }>();

  records.forEach((record) => {
    const normalizedCode = normalizeEmployeeCode(record.employeeCode);
    const employeeMeta = employeeMetaMap.get(normalizedCode) || buildEmployeeMeta();
    const onboardingDays = calculateOnboardingDays(employeeMeta.hireDate, effectiveReportStartDate, effectiveReportEndDate);
    const terminationPeriodDays = calculateTerminationPeriodDays(employeeMeta.terminationDate, effectiveReportEndDate);

    const penalties = Array.isArray(record.penalties) ? (record.penalties as any[]) : [];
    const isJoiningPeriod = record.status === "Joining Period";

    let dayType = "عمل";
    if (Number(record.terminationPeriodDays || 0) > 0 || record.status === "Termination Period") dayType = "فترة ترك";
    else if (isJoiningPeriod) dayType = "فترة التحاق";
    else if (record.leaveDeductionDays) dayType = "إجازة بالخصم";
    else if (record.excusedAbsenceDays) dayType = "غياب بعذر";
    else if (record.status === "Friday" || record.status === "Friday Attended") dayType = "جمعة";
    else if (record.isOfficialHoliday) dayType = "إجازة رسمية";
    else if (record.status === "Leave" || record.status === "Comp Day") dayType = "إجازة";

    let statusAr = "حضور";
    if (isJoiningPeriod) statusAr = "";
    else if (record.status === "Absent") statusAr = "غياب";
    else if (record.status === "Late") statusAr = "تأخير";
    else if (record.status === "Leave" || record.status === "Comp Day" || record.status === "Friday") statusAr = "إجازة";
    else if (record.status === "Leave Deduction") statusAr = "خصم";
    else if (record.status === "Termination Period") statusAr = "";

    const penaltiesByType = {
      late: 0,
      early: 0,
      missing: 0,
      absence: 0,
    };
    if (!isJoiningPeriod) {
      penalties.forEach((penalty: any) => {
        const value = Number(penalty.value || 0);
        if (penalty.type === "تأخير") penaltiesByType.late += value;
        if (penalty.type === "انصراف مبكر") penaltiesByType.early += value;
        if (penalty.type === "سهو بصمة") penaltiesByType.missing += value;
        if (penalty.type === "غياب") penaltiesByType.absence += value;
      });
    }

    const totalPenalties = isJoiningPeriod
      ? 0
      : penaltiesByType.late + penaltiesByType.early + penaltiesByType.missing + penaltiesByType.absence * 2 + Number(record.excusedAbsenceDays || 0);

    detailObjects.push({
      "التاريخ": toExcelDateSerial(String(record.date || "")) || "",
      "اليوم": arabicDayName(String(record.date || "")),
      "الكود": record.employeeCode,
      "اسم الموظف": employeeMeta.name,
      "القسم": employeeMeta.department,
      "تاريخ التعيين": employeeMeta.hireDateSerial,
      "تاريخ ترك العمل": employeeMeta.terminationDateSerial,
      "فترة الالتحاق": onboardingDays,
      "فترة الترك": terminationPeriodDays,
      "الدخول": isJoiningPeriod ? "" : (record.checkIn ? parseTimeToSeconds(toTimeText(record.checkIn)) / 86400 : ""),
      "الخروج": isJoiningPeriod ? "" : (record.checkOut ? parseTimeToSeconds(toTimeText(record.checkOut)) / 86400 : ""),
      "ساعات العمل": isJoiningPeriod ? 0 : Number(record.totalHours || 0),
      "الإضافي": isJoiningPeriod ? 0 : Number(record.overtimeHours || 0),
      "نوع اليوم": dayType,
      "الحالة": statusAr,
      "تأخير": isJoiningPeriod ? 0 : penaltiesByType.late,
      "انصراف مبكر": isJoiningPeriod ? 0 : penaltiesByType.early,
      "سهو بصمة": isJoiningPeriod ? 0 : penaltiesByType.missing,
      "غياب": isJoiningPeriod ? 0 : penaltiesByType.absence,
      "إجمالي الجزاءات": totalPenalties,
      "ملاحظات": isJoiningPeriod ? "" : cleanNotes(record.notes),
      "مدير الإدارة": employeeMeta.manager,
    });

    const existing = summaryByEmployee.get(normalizedCode) || {
      code: record.employeeCode,
      name: employeeMeta.name,
      department: employeeMeta.department,
      manager: employeeMeta.manager,
      hireDateSerial: employeeMeta.hireDateSerial,
      terminationDateSerial: employeeMeta.terminationDateSerial,
      onboardingDays,
      terminationPeriodDays,
      compDaysFriday: 0,
      compDaysOfficial: 0,
      late: 0,
      early: 0,
      missing: 0,
      absenceDays: 0,
      overtimeHours: 0,
      notes: "",
    };

    if (!isJoiningPeriod) {
      existing.late += penaltiesByType.late;
      existing.early += penaltiesByType.early;
      existing.missing += penaltiesByType.missing;
      existing.overtimeHours += Number(record.overtimeHours || 0);
      if (record.status === "Absent") existing.absenceDays += 1;
    }
    existing.compDaysFriday += Number(record.compDaysFriday || 0);
    existing.compDaysOfficial += Number(record.compDaysOfficial || 0);
    if (!existing.notes) existing.notes = cleanNotes(record.notes);

    summaryByEmployee.set(normalizedCode, existing);
  });

  const summaryObjects = Array.from(summaryByEmployee.values()).map((summary) => {
    const weightedAbsence = summary.absenceDays * 2;
    // Business rule: Total penalties = late + early + missing + (absence * 2)
    // ("إجمالي الغياب" is already weighted as absenceDays*2)
    const totalPenalties = summary.late + summary.early + summary.missing + weightedAbsence;
    return {
      "الكود": summary.code,
      "اسم الموظف": summary.name,
      "القسم": summary.department,
      "تاريخ التعيين": summary.hireDateSerial,
      "تاريخ ترك العمل": summary.terminationDateSerial,
      "فترة الالتحاق": summary.onboardingDays,
      "فترة الترك": summary.terminationPeriodDays,
      "بدل يوم الجمع": summary.compDaysFriday,
      "بدل أيام الإجازات الرسمية": summary.compDaysOfficial,
      "إجمالي أيام البدل": summary.compDaysFriday + summary.compDaysOfficial,
      "إجمالي التأخيرات": summary.late,
      "إجمالي الانصراف المبكر": summary.early,
      "إجمالي سهو البصمة": summary.missing,
      "إجمالي الغياب": weightedAbsence,
      "إجمالي الجزاءات": totalPenalties,
      // Summary notes column is intended for manual notes by HR (do not auto-pull record notes).
      "ملاحظات": "",
      "مدير الإدارة": summary.manager,
      "إجمالي الإضافي": summary.overtimeHours,
    };
  });

  return {
    detailHeaders: [...DETAIL_HEADERS],
    detailRows: mapRowsByHeaders(DETAIL_HEADERS, detailObjects),
    summaryHeaders: [...SUMMARY_HEADERS],
    summaryRows: mapRowsByHeaders(SUMMARY_HEADERS, summaryObjects),
  };
};
