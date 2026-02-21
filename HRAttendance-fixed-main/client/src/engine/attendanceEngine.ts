import { normalizeEmpCode, parseRuleScope } from "@shared/rule-scope";
import { normalizeEffectDateKey, normalizeEffectTimeKey, normalizeEffectType as normalizeUnifiedEffectType } from "@shared/effect-normalization";
import { normalizeEmployeeCode } from "@shared/employee-code";
import type {
  Adjustment,
  AttendanceRecord,
  BiometricPunch,
  Employee,
  Leave,
  OfficialHoliday,
  SpecialRule,
} from "@shared/schema";

export const ADJUSTMENT_TYPES = ["اذن صباحي", "اذن مسائي", "إجازة نص يوم", "مأمورية", "إجازة بالخصم", "غياب بعذر", "إجازة من الرصيد", "إجازة بدل"] as const;

export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export type AdjustmentInput = {
  type: AdjustmentType;
  fromTime: string;
  toTime: string;
};

export const normalizeTimeToHms = (value: string) => {
  const parts = value.trim().split(":");
  const [rawH = "0", rawM = "0", rawS = "0"] = parts;
  const h = String(Number(rawH)).padStart(2, "0");
  const m = String(Number(rawM)).padStart(2, "0");
  const s = String(Number(rawS)).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export const timeStringToSeconds = (value: string) => {
  const normalized = normalizeTimeToHms(value);
  const [h, m, s] = normalized.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

export const secondsToHms = (value: number) => {
  const total = Math.max(0, Math.floor(value));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export const computeAdjustmentEffects = ({
  shiftStart,
  shiftEnd,
  adjustments,
  checkInSeconds,
  checkOutSeconds,
}: {
  shiftStart: string;
  shiftEnd: string;
  adjustments: AdjustmentInput[];
  checkInSeconds?: number | null;
  checkOutSeconds?: number | null;
}) => {
  const shiftStartSeconds = timeStringToSeconds(shiftStart);
  const shiftEndSeconds = timeStringToSeconds(shiftEnd);
  let effectiveShiftStartSeconds = shiftStartSeconds;
  let effectiveShiftEndSeconds = shiftEndSeconds;
  let missionStartSeconds: number | null = null;
  let missionEndSeconds: number | null = null;
  let suppressPenalties = false;
  let halfDayExcused = false;

  for (const adjustment of adjustments) {
    const fromSeconds = timeStringToSeconds(adjustment.fromTime);
    const toSeconds = timeStringToSeconds(adjustment.toTime);
    if (adjustment.type === "اذن صباحي") {
      effectiveShiftStartSeconds = Math.max(effectiveShiftStartSeconds, toSeconds);
    }
    if (adjustment.type === "اذن مسائي") {
      effectiveShiftEndSeconds = Math.min(effectiveShiftEndSeconds, fromSeconds);
    }
    if (adjustment.type === "إجازة نص يوم") {
      if (fromSeconds === shiftStartSeconds) {
        effectiveShiftStartSeconds = toSeconds;
        halfDayExcused = true;
      }
      if (toSeconds === shiftEndSeconds) {
        effectiveShiftEndSeconds = fromSeconds;
        halfDayExcused = true;
      }
    }
    if (adjustment.type === "مأمورية") {
      missionStartSeconds = missionStartSeconds === null ? fromSeconds : Math.min(missionStartSeconds, fromSeconds);
      missionEndSeconds = missionEndSeconds === null ? toSeconds : Math.max(missionEndSeconds, toSeconds);
      suppressPenalties = true;
    }
  }

  const allFirstCandidates = [checkInSeconds ?? null, missionStartSeconds].filter(
    (value): value is number => value !== null && value !== undefined
  );
  const allLastCandidates = [checkOutSeconds ?? null, missionEndSeconds].filter(
    (value): value is number => value !== null && value !== undefined
  );
  const firstStampSeconds = allFirstCandidates.length > 0 ? Math.min(...allFirstCandidates) : null;
  const lastStampSeconds = allLastCandidates.length > 0 ? Math.max(...allLastCandidates) : null;

  return {
    effectiveShiftStartSeconds,
    effectiveShiftEndSeconds,
    missionStartSeconds,
    missionEndSeconds,
    suppressPenalties,
    halfDayExcused,
    firstStampSeconds,
    lastStampSeconds,
  };
};

export const resolveShiftForDate = ({
  employee,
  dateStr,
  rules,
}: {
  employee: Employee;
  dateStr: string;
  rules: SpecialRule[];
}) => {
  const normalizedEmployeeCode = String(employee.code ?? "").trim();
  const activeRules = rules.filter((rule) => {
    const ruleStart = new Date(rule.startDate);
    const ruleEnd = new Date(rule.endDate);
    const current = new Date(dateStr);
    if (current < ruleStart || current > ruleEnd) return false;

    if (rule.scope === "all") return true;
    if (rule.scope.startsWith("dept:") && employee.department === rule.scope.replace("dept:", "")) return true;
    if (rule.scope.startsWith("sector:") && employee.sector === rule.scope.replace("sector:", "")) return true;
    if (rule.scope.startsWith("emp:")) {
      const parsedScope = parseRuleScope(rule.scope);
      const normalized = normalizeEmpCode(normalizedEmployeeCode);
      return parsedScope.type === "emp" && parsedScope.values.includes(normalized);
    }
    return false;
  }).sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const dayOfWeek = new Date(dateStr).getUTCDay();
  let shiftStart = "09:00";
  let shiftEnd = "17:00";

  const shiftRule = activeRules.find((rule) => rule.ruleType === "custom_shift");
  if (shiftRule) {
    shiftStart = (shiftRule.params as any).shiftStart || shiftStart;
    shiftEnd = (shiftRule.params as any).shiftEnd || shiftEnd;
  } else if (dayOfWeek === 6) {
    shiftStart = "10:00";
    shiftEnd = "16:00";
  }

  return {
    activeRules,
    dayOfWeek,
    shiftStart,
    shiftEnd,
  };
};

export const appendNotes = (existingNotes: string | null | undefined, additions: string[]) => {
  const existing = (existingNotes || "")
    .split(/[،,]/)
    .map((note) => note.trim())
    .filter(Boolean);
  const set = new Set(existing);
  additions.forEach((note) => set.add(note));
  return Array.from(set).join("، ");
};

export const composeDailyNotes = ({
  baseNotes,
  extraNotes,
  leaveNotes,
  hasOvernightStay,
}: {
  baseNotes?: string | null;
  extraNotes: string[];
  leaveNotes: string[];
  hasOvernightStay: boolean;
}) => {
  if (hasOvernightStay) return "مبيت";
  return appendNotes(baseNotes, [...extraNotes, ...leaveNotes]);
};

export const buildPunchConsumptionKey = (employeeCode: string, punchDatetime: Date) =>
  `${employeeCode}__${punchDatetime.getTime()}`;

export const filterConsumedPunches = <T extends { employeeCode: string; punchDatetime: Date }>(
  punches: T[],
  consumed: Set<string> | null | undefined
) => {
  if (!consumed || consumed.size === 0) return punches;
  return punches.filter((punch) => !consumed.has(buildPunchConsumptionKey(punch.employeeCode, punch.punchDatetime)));
};

export const computeAutomaticNotes = ({
  existingNotes,
  checkInExists,
  checkOutExists,
  missingStampExcused,
  earlyLeaveExcused,
  checkOutBeforeEarlyLeave,
}: {
  existingNotes?: string | null;
  checkInExists: boolean;
  checkOutExists: boolean;
  missingStampExcused: boolean;
  earlyLeaveExcused: boolean;
  checkOutBeforeEarlyLeave: boolean;
}) => {
  const notes: string[] = [];
  if (checkInExists && !checkOutExists && !missingStampExcused) {
    notes.push("سهو بصمة");
  }
  if (!checkInExists && checkOutExists && !missingStampExcused) {
    notes.push("سهو بصمة دخول");
  }
  if (checkOutExists && checkOutBeforeEarlyLeave && !earlyLeaveExcused) {
    notes.push("انصراف مبكر");
  }
  return appendNotes(existingNotes, notes);
};

export const computePenaltyEntries = ({
  isExcused,
  latePenaltyValue,
  lateMinutes,
  missingCheckout,
  earlyLeaveTriggered,
}: {
  isExcused: boolean;
  latePenaltyValue: number;
  lateMinutes: number;
  missingCheckout: boolean;
  earlyLeaveTriggered: boolean;
}) => {
  if (isExcused) return [] as { type: string; value: number; minutes?: number }[];
  const entries: { type: string; value: number; minutes?: number }[] = [];
  if (latePenaltyValue > 0) {
    entries.push({ type: "تأخير", value: latePenaltyValue, minutes: lateMinutes });
  }
  if (missingCheckout) {
    entries.push({ type: "سهو بصمة", value: 0.5 });
  } else if (earlyLeaveTriggered) {
    entries.push({ type: "انصراف مبكر", value: 0.5 });
  }
  return entries;
};

export const computeOvertimeHours = ({
  shiftEnd,
  checkOutSeconds,
}: {
  shiftEnd: string;
  checkOutSeconds: number | null;
}) => {
  if (checkOutSeconds === null) return 0;
  const shiftEndSeconds = timeStringToSeconds(shiftEnd);
  const overtimeStartSeconds = shiftEndSeconds + 60 * 60;
  if (checkOutSeconds <= overtimeStartSeconds) return 0;
  const eligibleMinutes = Math.floor((checkOutSeconds - overtimeStartSeconds) / 60);
  return Math.floor(eligibleMinutes / 60);
};

const parseEmployeeScope = (scope: string, employee: Employee, normalizedEmployeeCode: string) => {
  if (!scope || scope === "all") return true;
  if (scope.startsWith("dept:")) return employee.department === scope.replace("dept:", "");
  if (scope.startsWith("sector:")) return employee.sector === scope.replace("sector:", "");
  if (scope.startsWith("emp:")) {
    const parsedScope = parseRuleScope(scope);
    const normalized = normalizeEmpCode(normalizedEmployeeCode);
    return parsedScope.type === "emp" && parsedScope.values.some((value) => value === normalized);
  }
  return false;
};



export type ImportedEffect = {
  employeeCode: string;
  date: string;
  from?: string;
  to?: string;
  fromTime?: string;
  toTime?: string;
  type: string;
  status?: string;
  note?: string;
};

const buildSyntheticAdjustment = (employeeCode: string, date: string, type: string, fromTime: string, toTime: string, note?: string): Adjustment => ({
  id: -1,
  employeeCode,
  date,
  type: type as any,
  fromTime,
  toTime,
  source: "effects_store",
  sourceFileName: null,
  importedAt: new Date(),
  note: note || null,
} as Adjustment);

export const applyEffectsToDailyRecord = ({
  employeeCode,
  dateStr,
  dayAdjustments,
  dayEffects,
  shiftStart,
  shiftEnd,
  defaultPermissionMinutes = 120,
  defaultHalfDayMinutes = 240,
}: {
  employeeCode: string;
  dateStr: string;
  dayAdjustments: Adjustment[];
  dayEffects: ImportedEffect[];
  shiftStart: string;
  shiftEnd: string;
  defaultPermissionMinutes?: number;
  defaultHalfDayMinutes?: number;
}) => {
  const mergedAdjustments = [...dayAdjustments];
  const notes: string[] = [];
  const missionRanges: Array<{ from: string; to: string }> = [];
  const shiftStartSeconds = timeStringToSeconds(shiftStart);
  const shiftEndSeconds = timeStringToSeconds(shiftEnd);
  const permissionSeconds = Math.max(0, Number(defaultPermissionMinutes || 120)) * 60;
  const halfDaySeconds = Math.max(0, Number(defaultHalfDayMinutes || 240)) * 60;

  dayEffects.forEach((effect) => {
    const type = normalizeUnifiedEffectType(effect.type);
    const from = normalizeEffectTimeKey(effect.fromTime || effect.from || "");
    const to = normalizeEffectTimeKey(effect.toTime || effect.to || "");

    if (type === "مأمورية") {
      if (from && to) missionRanges.push({ from, to });
      else notes.push("مأمورية ناقص ساعات");
      return;
    }

    if (type === "اذن صباحي" || type === "اذن مسائي") {
      const fromResolved = from || (type === "اذن صباحي" ? secondsToHms(shiftStartSeconds) : secondsToHms(Math.max(0, shiftEndSeconds - permissionSeconds)));
      const toResolved = to || (type === "اذن صباحي" ? secondsToHms(shiftStartSeconds + permissionSeconds) : secondsToHms(shiftEndSeconds));
      mergedAdjustments.push(buildSyntheticAdjustment(employeeCode, dateStr, type, fromResolved, toResolved, effect.note));
      return;
    }

    if (type === "اجازة نصف يوم" || type === "اجازة نص يوم") {
      const fromResolved = from || secondsToHms(shiftStartSeconds);
      const toResolved = to || secondsToHms(shiftStartSeconds + halfDaySeconds);
      mergedAdjustments.push(buildSyntheticAdjustment(employeeCode, dateStr, "إجازة نص يوم", fromResolved, toResolved, effect.note));
      return;
    }

    if (type === "اجازة بالخصم") {
      mergedAdjustments.push(buildSyntheticAdjustment(employeeCode, dateStr, "إجازة بالخصم", "00:00:00", "00:00:00", effect.note));
      return;
    }

    if (type === "غياب بعذر") {
      mergedAdjustments.push(buildSyntheticAdjustment(employeeCode, dateStr, "غياب بعذر", "00:00:00", "00:00:00", effect.note));
      return;
    }

    if (type === "اجازة من الرصيد") {
      mergedAdjustments.push(buildSyntheticAdjustment(employeeCode, dateStr, "إجازة من الرصيد", "00:00:00", "00:00:00", effect.note));
      return;
    }

    if (type === "اجازة بدل") {
      mergedAdjustments.push(buildSyntheticAdjustment(employeeCode, dateStr, "إجازة بدل", "00:00:00", "00:00:00", effect.note));
      return;
    }

    notes.push(`Needs Mapping: ${effect.type}`);
  });

  if (missionRanges.length > 0) {
    const missionStart = missionRanges.reduce((min, r) => timeStringToSeconds(r.from) < timeStringToSeconds(min) ? r.from : min, missionRanges[0].from);
    const missionEnd = missionRanges.reduce((max, r) => timeStringToSeconds(r.to) > timeStringToSeconds(max) ? r.to : max, missionRanges[0].to);
    if (missionRanges.length > 1) notes.push("تم دمج أكثر من مأمورية في أوسع نطاق");
    mergedAdjustments.push(buildSyntheticAdjustment(employeeCode, dateStr, "مأمورية", missionStart, missionEnd));
  }

  return { mergedAdjustments, notes };
};

export type ProcessAttendanceParams = {
  employees: Employee[];
  punches: BiometricPunch[];
  rules: SpecialRule[];
  leaves: Leave[];
  officialHolidays: OfficialHoliday[];
  adjustments: Adjustment[];
  effects?: ImportedEffect[];
  startDate: string;
  endDate: string;
  timezoneOffsetMinutes?: number;
  workedOnOfficialHolidayOverrides?: Map<string, boolean>;
  employeeCodes?: string[];
  defaultPermissionMinutes?: number;
  defaultHalfDayMinutes?: number;
};

export const processAttendanceRecords = ({
  employees,
  punches,
  rules = [],
  leaves = [],
  officialHolidays = [],
  adjustments = [],
  effects = [],
  startDate,
  endDate,
  timezoneOffsetMinutes,
  workedOnOfficialHolidayOverrides,
  employeeCodes,
  defaultPermissionMinutes,
  defaultHalfDayMinutes,
}: ProcessAttendanceParams): AttendanceRecord[] => {
  const offsetMinutes = Number.isFinite(Number(timezoneOffsetMinutes))
    ? Number(timezoneOffsetMinutes)
    : -120;

  const toLocal = (date: Date) => new Date(date.getTime() - offsetMinutes * 60 * 1000);

  const formatLocalDay = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const normalizeDateKey = (value?: string | null) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

  const searchStart = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const searchEnd = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  const adjustmentsByEmployeeDate = new Map<string, Adjustment[]>();
  adjustments.forEach((adjustment) => {
    const key = `${normalizeEmployeeCode(adjustment.employeeCode)}__${normalizeEffectDateKey(adjustment.date)}`;
    const existing = adjustmentsByEmployeeDate.get(key) || [];
    existing.push(adjustment);
    adjustmentsByEmployeeDate.set(key, existing);
  });
  const effectsByEmpDate = new Map<string, ImportedEffect[]>();
  effects.forEach((effect) => {
    const key = `${normalizeEmployeeCode(effect.employeeCode)}__${normalizeEffectDateKey(effect.date)}`;
    const existing = effectsByEmpDate.get(key) || [];
    existing.push(effect);
    effectsByEmpDate.set(key, existing);
  });


  const records: AttendanceRecord[] = [];
  let recordId = 1;

  const normalizedTargets = new Set((employeeCodes || []).map((code) => normalizeEmployeeCode(code)).filter(Boolean));
  const employeesToProcess = normalizedTargets.size > 0
    ? employees.filter((employee) => normalizedTargets.has(normalizeEmployeeCode(employee.code)))
    : employees;

  for (const employee of employeesToProcess) {
    const normalizedEmployeeCode = normalizeEmployeeCode(employee.code);
    const punchesByDate = new Map<string, BiometricPunch[]>();
    punches.forEach((punch) => {
      if (normalizeEmployeeCode(punch.employeeCode) !== normalizedEmployeeCode) return;
      const localPunch = toLocal(punch.punchDatetime);
      const py = localPunch.getUTCFullYear();
      const pm = String(localPunch.getUTCMonth() + 1).padStart(2, "0");
      const pd = String(localPunch.getUTCDate()).padStart(2, "0");
      const dateKey = `${py}-${pm}-${pd}`;
      const list = punchesByDate.get(dateKey) || [];
      list.push(punch);
      punchesByDate.set(dateKey, list);
    });

    punchesByDate.forEach((list) => {
      list.sort((a, b) => a.punchDatetime.getTime() - b.punchDatetime.getTime());
    });

    const extraNotesByKey = new Map<string, string[]>();
    const addExtraNote = (key: string, note: string) => {
      const existing = extraNotesByKey.get(key) || [];
      existing.push(note);
      extraNotesByKey.set(key, existing);
    };
    const consumedPunchesByDate = new Map<string, Set<string>>();
    const markPunchConsumed = (dateKey: string, punch: BiometricPunch) => {
      const key = buildPunchConsumptionKey(punch.employeeCode, punch.punchDatetime);
      const existing = consumedPunchesByDate.get(dateKey) || new Set<string>();
      existing.add(key);
      consumedPunchesByDate.set(dateKey, existing);
    };

    const shiftStartHour = Number.parseInt((employee.shiftStart || "09:00").split(":")[0], 10);
    const arrivalWindows: Record<number, { start: number; end: number }> = {
      9: { start: 6, end: 12 },
      8: { start: 5, end: 11 },
      7: { start: 4, end: 10 },
    };
    const arrivalWindow = arrivalWindows[shiftStartHour] || arrivalWindows[9];
    const isOvernightPunch = (date: Date) => {
      const hour = date.getUTCHours();
      return hour >= 0 && hour <= 5;
    };
    const isNormalArrivalPunch = (date: Date) => {
      const hour = date.getUTCHours();
      return hour >= arrivalWindow.start && hour <= arrivalWindow.end;
    };
    const isEarlyShiftEdge = (date: Date) => {
      const hour = date.getUTCHours();
      const minute = date.getUTCMinutes();
      return shiftStartHour <= 7 && (hour === 4 && minute >= 30 || hour === 5 && minute === 0);
    };
    const toUtcFromSeconds = (baseDate: Date, seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const shiftTimeUTC = new Date(Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth(),
        baseDate.getUTCDate(),
        hours,
        minutes,
        secs
      ));
      shiftTimeUTC.setTime(shiftTimeUTC.getTime() + offsetMinutes * 60 * 1000);
      return shiftTimeUTC;
    };
    const matchesScope = (scope: string, value: string | null | undefined) => {
      if (scope === "all") return true;
      if (scope === "sector") return value === employee.sector;
      if (scope === "department") return value === employee.department;
      if (scope === "section") return value === employee.section;
      if (scope === "branch") return value === employee.branch;
      if (scope === "emp") return value === employee.code;
      return false;
    };
    const appliesLeave = (leave: Leave, dateStr: string) => {
      if (dateStr < leave.startDate || dateStr > leave.endDate) return false;
      if (leave.type === "collections" && employee.sector !== "التحصيل") return false;
      return matchesScope(leave.scope, leave.scopeValue || null);
    };

    for (let d = new Date(searchStart); d <= searchEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = formatLocalDay(d);
      const prevDate = new Date(d);
      prevDate.setUTCDate(prevDate.getUTCDate() - 1);
      const prevDateStr = formatLocalDay(prevDate);
      const dayPunches = punchesByDate.get(dateStr) || [];
      const prevPunches = punchesByDate.get(prevDateStr) || [];

      if (dayPunches.length === 0) continue;

      const overnightPunches = dayPunches.filter((punch) => {
        const localPunch = toLocal(punch.punchDatetime);
        return isOvernightPunch(localPunch);
      });

      if (overnightPunches.length === 0) continue;

      overnightPunches.forEach((punch) => {
        const localPunch = toLocal(punch.punchDatetime);
        const hasPrevCheckIn = prevPunches.length > 0;
        const hasPrevCheckOut = prevPunches.length > 1;
        if (!hasPrevCheckIn) return;

        const hasNormalArrival = dayPunches.some((candidate) => {
          if (candidate === punch) return false;
          const localCandidate = toLocal(candidate.punchDatetime);
          return isNormalArrivalPunch(localCandidate);
        });

        if (!hasPrevCheckOut && isEarlyShiftEdge(localPunch) && !hasNormalArrival) {
          return;
        }

        if (!hasPrevCheckOut || hasNormalArrival) {
          const updatedDayPunches = dayPunches.filter((item) => item !== punch);
          updatedDayPunches.sort((a, b) => a.punchDatetime.getTime() - b.punchDatetime.getTime());
          punchesByDate.set(dateStr, updatedDayPunches);

          const updatedPrevPunches = [...prevPunches, punch].sort(
            (a, b) => a.punchDatetime.getTime() - b.punchDatetime.getTime()
          );
          punchesByDate.set(prevDateStr, updatedPrevPunches);
          markPunchConsumed(dateStr, punch);

          const timeLabel = `${String(localPunch.getUTCHours()).padStart(2, "0")}:${String(localPunch.getUTCMinutes()).padStart(2, "0")}`;
          addExtraNote(prevDateStr, `خروج بعد منتصف الليل ${timeLabel} (${dateStr})`);
        }
      });
    }

    for (let d = new Date(searchStart); d <= searchEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = formatLocalDay(d);
      const hireDateKey = normalizeDateKey(employee.hireDate || null);
      const isJoiningPeriod = Boolean(hireDateKey && dateStr < hireDateKey);
      const terminationDateKey = normalizeDateKey(employee.terminationDate || null);
      const isTerminationPeriod = Boolean(terminationDateKey && dateStr > terminationDateKey);
      const holidayMatch = officialHolidays.find((holiday) => holiday.date === dateStr);
      const isOfficialHoliday = Boolean(holidayMatch);

      const { activeRules, dayOfWeek, shiftStart: currentShiftStart, shiftEnd: currentShiftEnd } = resolveShiftForDate({
        employee,
        dateStr,
        rules,
      });
      const isFriday = dayOfWeek === 5;
      const leaveRule = activeRules.find((rule) => rule.ruleType === "attendance_exempt");
      const leaveTypeRaw = typeof (leaveRule?.params as any)?.leaveType === "string"
        ? String((leaveRule?.params as any)?.leaveType).toLowerCase()
        : "";
      const leaveCategoryFromRule = leaveRule
        ? (leaveTypeRaw === "official" ? "Official Leave" : "HR Leave")
        : null;
      const matchedLeaves = leaves.filter((leave) => appliesLeave(leave, dateStr));
      const hasOfficialLeave = matchedLeaves.some((leave) => leave.type === "official");
      const leaveCategoryFromLeave = matchedLeaves.length > 0
        ? (hasOfficialLeave ? "Official Leave" : "HR Leave")
        : null;
      const leaveNotes = matchedLeaves.map((leave) => leave.note).filter(Boolean) as string[];
      const leaveCategory = leaveCategoryFromRule || leaveCategoryFromLeave;
      const isLeaveDay = Boolean(leaveRule || matchedLeaves.length > 0);
      const hasOvernightStay = activeRules.some((rule) => rule.ruleType === "overnight_stay");

      const baseDayAdjustments = adjustmentsByEmployeeDate.get(`${normalizedEmployeeCode}__${dateStr}`) || [];
      const dayEffects = effectsByEmpDate.get(`${normalizedEmployeeCode}__${dateStr}`) || [];
      const { mergedAdjustments: dayAdjustments, notes: effectNotes } = applyEffectsToDailyRecord({
        employeeCode: employee.code,
        dateStr,
        dayAdjustments: baseDayAdjustments,
        dayEffects,
        shiftStart: currentShiftStart,
        shiftEnd: currentShiftEnd,
        defaultPermissionMinutes,
        defaultHalfDayMinutes,
      });
      effectNotes.forEach((note) => addExtraNote(dateStr, note));
      const leaveDeductionAdjustments = dayAdjustments.filter((adj) => adj.type === "إجازة بالخصم");
      const excusedAbsenceAdjustments = dayAdjustments.filter((adj) => adj.type === "غياب بعذر");
      const hasLeaveDeduction = leaveDeductionAdjustments.length > 0;
      const hasLeaveFromBalance = dayAdjustments.some((adj) => adj.type === "إجازة من الرصيد");
      const hasCompDayUsed = dayAdjustments.some((adj) => adj.type === "إجازة بدل");
      const hasExcusedAbsence = excusedAbsenceAdjustments.length > 0;

      if (isJoiningPeriod) {
        records.push({
          id: recordId++,
          employeeCode: employee.code,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          totalHours: 0,
          status: "Joining Period",
          overtimeHours: 0,
          penalties: [],
          isOvernight: false,
          notes: null,
          missionStart: null,
          missionEnd: null,
          halfDayExcused: false,
          isOfficialHoliday: false,
          workedOnOfficialHoliday: null,
          compDayCredit: 0,
          leaveDeductionDays: 0,
          excusedAbsenceDays: 0,
          terminationPeriodDays: 0,
          compDaysFriday: 0,
          compDaysOfficial: 0,
          compDaysTotal: 0,
          compDaysUsed: 0,
        } as AttendanceRecord);
        continue;
      }

      const consumedPunches = consumedPunchesByDate.get(dateStr);
      const dayPunches = filterConsumedPunches(punchesByDate.get(dateStr) || [], consumedPunches)
        .slice()
        .sort((a, b) => a.punchDatetime.getTime() - b.punchDatetime.getTime());

      const checkIn = dayPunches.length > 0 ? dayPunches[0].punchDatetime : null;
      const checkOut = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1].punchDatetime : null;
      const checkInLocal = checkIn ? toLocal(checkIn) : null;
      const checkOutLocal = checkOut ? toLocal(checkOut) : null;

      let totalHours = 0;
      if (checkInLocal && checkOutLocal) {
        totalHours = (checkOutLocal.getTime() - checkInLocal.getTime()) / (1000 * 60 * 60);
      }

      if (isTerminationPeriod) {
        const extraNotes = extraNotesByKey.get(dateStr) || [];
        records.push({
          id: recordId++,
          employeeCode: employee.code,
          date: dateStr,
          checkIn,
          checkOut,
          totalHours,
          status: "Termination Period",
          overtimeHours: 0,
          penalties: [],
          isOvernight: false,
          notes: composeDailyNotes({
            baseNotes: "فترة ترك",
            extraNotes,
            leaveNotes,
            hasOvernightStay: false,
          }),
          missionStart: null,
          missionEnd: null,
          halfDayExcused: false,
          isOfficialHoliday: false,
          workedOnOfficialHoliday: null,
          compDayCredit: 0,
          leaveDeductionDays: 1,
          excusedAbsenceDays: 0,
          terminationPeriodDays: 1,
          compDaysFriday: 0,
          compDaysOfficial: 0,
          compDaysTotal: 0,
          compDaysUsed: 0,
        } as AttendanceRecord);
        continue;
      }

      if (isOfficialHoliday) {
        const overrideKey = `${normalizedEmployeeCode}__${dateStr}`;
        const override = workedOnOfficialHolidayOverrides?.get(overrideKey);
        const hasMission = dayAdjustments.some((adj) => adj.type === "مأمورية");
        const autoWorked = Boolean(checkIn || checkOut) || totalHours > 0 || hasMission;
        const worked = override ?? autoWorked;
        const extraNotes = extraNotesByKey.get(dateStr) || [];
        const compDaysOfficial = worked ? 1 : 0;
        records.push({
          id: recordId++,
          employeeCode: employee.code,
          date: dateStr,
          checkIn,
          checkOut,
          totalHours,
          status: "Official Holiday",
          overtimeHours: 0,
          penalties: [],
          isOvernight: false,
          notes: composeDailyNotes({
            baseNotes: holidayMatch?.name || "إجازة رسمية",
            extraNotes,
            leaveNotes,
            hasOvernightStay: false,
          }),
          missionStart: null,
          missionEnd: null,
          halfDayExcused: false,
          isOfficialHoliday: true,
          workedOnOfficialHoliday: override ?? null,
          compDayCredit: worked ? 1 : 0,
          leaveDeductionDays: hasLeaveDeduction ? 1 : 0,
          excusedAbsenceDays: hasExcusedAbsence ? 1 : 0,
          terminationPeriodDays: 0,
          compDaysFriday: 0,
          compDaysOfficial,
          compDaysTotal: compDaysOfficial,
          compDaysUsed: hasCompDayUsed ? 1 : 0,
        } as AttendanceRecord);
        continue;
      }

      if (isFriday || isLeaveDay) {
        const attendedFriday = isFriday && dayPunches.some((punch) => {
          const localPunch = toLocal(punch.punchDatetime);
          const seconds = localPunch.getUTCHours() * 3600 + localPunch.getUTCMinutes() * 60 + localPunch.getUTCSeconds();
          const windowAStart = 11 * 3600;
          const windowAEnd = 16 * 3600;
          const windowBStart = 12 * 3600;
          const windowBEnd = 17 * 3600;
          return (seconds >= windowAStart && seconds <= windowAEnd)
            || (seconds >= windowBStart && seconds <= windowBEnd);
        });
        const hasMission = dayAdjustments.some((adj) => adj.type === "مأمورية");
        const nextDay = new Date(d);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        const nextDayShiftStartUTC = toUtcFromSeconds(nextDay, timeStringToSeconds(currentShiftStart));
        const effectiveCheckOutDateTime = hasOvernightStay ? nextDayShiftStartUTC : checkOutLocal;
        const overtimeStart = new Date(
          toUtcFromSeconds(d, timeStringToSeconds(currentShiftEnd)).getTime() + 60 * 60 * 1000
        );
        void overtimeStart;
        void effectiveCheckOutDateTime;
        const extraNotes = extraNotesByKey.get(dateStr) || [];
        const compDaysFriday = isFriday && (attendedFriday || hasMission) ? 1 : 0;
        records.push({
          id: recordId++,
          employeeCode: employee.code,
          date: dateStr,
          checkIn,
          checkOut,
          totalHours: isFriday ? 0 : totalHours,
          status: isFriday ? (attendedFriday ? "Friday Attended" : "Friday") : "Comp Day",
          overtimeHours: 0,
          penalties: [],
          isOvernight: false,
          notes: composeDailyNotes({
            baseNotes: isLeaveDay ? leaveCategory : null,
            extraNotes,
            leaveNotes,
            hasOvernightStay,
          }),
          missionStart: null,
          missionEnd: null,
          halfDayExcused: false,
          isOfficialHoliday: false,
          workedOnOfficialHoliday: null,
          compDayCredit: 0,
          leaveDeductionDays: hasLeaveDeduction ? 1 : 0,
          excusedAbsenceDays: hasExcusedAbsence ? 1 : 0,
          terminationPeriodDays: 0,
          compDaysFriday,
          compDaysOfficial: 0,
          compDaysTotal: compDaysFriday,
          compDaysUsed: hasCompDayUsed ? 1 : 0,
        } as AttendanceRecord);
        continue;
      }

      if (dayPunches.length > 0 || dayAdjustments.length > 0) {
        const checkInSeconds = checkInLocal
          ? checkInLocal.getUTCHours() * 3600 + checkInLocal.getUTCMinutes() * 60 + checkInLocal.getUTCSeconds()
          : null;
        const checkOutSecondsRaw = checkOutLocal
          ? checkOutLocal.getUTCHours() * 3600 + checkOutLocal.getUTCMinutes() * 60 + checkOutLocal.getUTCSeconds()
          : null;
        const checkOutSeconds = hasOvernightStay ? null : checkOutSecondsRaw;

        const adjustmentEffects = computeAdjustmentEffects({
          shiftStart: currentShiftStart,
          shiftEnd: currentShiftEnd,
          adjustments: dayAdjustments.map((adj) => ({
            type: adj.type as AdjustmentType,
            fromTime: adj.fromTime,
            toTime: adj.toTime,
          })),
          checkInSeconds,
          checkOutSeconds,
        });

        const effectiveShiftStartUTC = toUtcFromSeconds(d, adjustmentEffects.effectiveShiftStartSeconds);
        const effectiveShiftEndUTC = toUtcFromSeconds(d, adjustmentEffects.effectiveShiftEndSeconds);
        const missionStart = adjustmentEffects.missionStartSeconds !== null
          ? secondsToHms(adjustmentEffects.missionStartSeconds)
          : null;
        const missionEnd = adjustmentEffects.missionEndSeconds !== null
          ? secondsToHms(adjustmentEffects.missionEndSeconds)
          : null;

        const firstStampSeconds = adjustmentEffects.firstStampSeconds;
        const lastStampSeconds = adjustmentEffects.lastStampSeconds;
        const checkInDateTime = checkInLocal;
        const checkOutDateTime = hasOvernightStay ? null : checkOutLocal;
        if (checkInDateTime && checkOutDateTime) {
          const diffMs = checkOutDateTime.getTime() - checkInDateTime.getTime();
          totalHours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
        } else if (firstStampSeconds !== null && lastStampSeconds !== null) {
          const firstStampUTC = toUtcFromSeconds(d, firstStampSeconds);
          const lastStampUTC = toUtcFromSeconds(d, lastStampSeconds);
          totalHours = (lastStampUTC.getTime() - firstStampUTC.getTime()) / (1000 * 60 * 60);
        }

        const penalties: { type: string; value: number; minutes?: number }[] = [];
        let status = "Present";
        const graceMinutes = 15;
        const suppressPenalties = adjustmentEffects.suppressPenalties;
        const hasMission = adjustmentEffects.missionStartSeconds !== null && adjustmentEffects.missionEndSeconds !== null;
        const halfDayExcused = adjustmentEffects.halfDayExcused;
        const excusedByHalfDayNoPunch = halfDayExcused && !checkIn && !checkOut;
        const excusedByMission = hasMission;
        const excusedDay = excusedByHalfDayNoPunch || excusedByMission;
        const isExcusedForPenalties = excusedDay || suppressPenalties || hasOvernightStay || hasLeaveDeduction || hasLeaveFromBalance || hasCompDayUsed || hasExcusedAbsence;
        let latePenaltyValue = 0;
        let lateMinutes = 0;

        if (!isExcusedForPenalties && checkIn) {
          const diffMs = checkIn.getTime() - effectiveShiftStartUTC.getTime();
          lateMinutes = Math.max(0, Math.ceil(diffMs / (1000 * 60)));

          if (diffMs > graceMinutes * 60 * 1000) {
            status = "Late";
            if (lateMinutes > 60) latePenaltyValue = 1;
            else if (lateMinutes > 30) latePenaltyValue = 0.5;
            else latePenaltyValue = 0.25;
          } else {
            status = "Present";
          }
        } else if (!isExcusedForPenalties && !checkIn && !checkOut) {
          status = "Absent";
          penalties.push({ type: "غياب", value: 1 });
        }
        if (hasOvernightStay) {
          status = "Present";
        }
        if (hasLeaveDeduction) {
          status = "Leave Deduction";
        }
        if (hasLeaveFromBalance || hasCompDayUsed) {
          status = "Leave";
        }
        if (hasExcusedAbsence && !checkIn && !checkOut) {
          status = "Excused Absence";
        }

        const effectiveCheckOutForPenalties = hasOvernightStay ? null : checkOut;
        const missingCheckout = Boolean(checkIn && !effectiveCheckOutForPenalties) && !isExcusedForPenalties;
        const earlyLeaveThreshold = effectiveShiftEndUTC.getTime() - graceMinutes * 60 * 1000;
        const earlyLeaveTriggered = Boolean(
          effectiveCheckOutForPenalties &&
          !missingCheckout &&
          !isExcusedForPenalties &&
          effectiveCheckOutForPenalties.getTime() < earlyLeaveThreshold
        );

        penalties.push(
          ...computePenaltyEntries({
            isExcused: isExcusedForPenalties,
            latePenaltyValue,
            lateMinutes,
            missingCheckout,
            earlyLeaveTriggered,
          })
        );

        if (excusedDay) {
          status = hasMission && adjustmentEffects.missionEndSeconds !== null &&
            adjustmentEffects.missionEndSeconds >= timeStringToSeconds(currentShiftEnd)
            ? "Present"
            : "Excused";
        }
        const autoNotes = computeAutomaticNotes({
          existingNotes: null,
          checkInExists: Boolean(checkIn),
          checkOutExists: Boolean(checkOut),
          missingStampExcused: excusedDay || hasOvernightStay,
          earlyLeaveExcused: excusedDay || hasOvernightStay,
          checkOutBeforeEarlyLeave: Boolean(effectiveCheckOutForPenalties && effectiveCheckOutForPenalties.getTime() < earlyLeaveThreshold),
        });

        const nextDay = new Date(d);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        const nextDayShiftStartUTC = toUtcFromSeconds(nextDay, adjustmentEffects.effectiveShiftStartSeconds);
        const effectiveCheckOutDateTime = hasOvernightStay
          ? nextDayShiftStartUTC
          : checkOutDateTime;
        if (checkInDateTime && effectiveCheckOutDateTime) {
          const diffMs = effectiveCheckOutDateTime.getTime() - checkInDateTime.getTime();
          totalHours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
        }
        const overtimeStart = new Date(effectiveShiftEndUTC.getTime() + 60 * 60 * 1000);
        const overtimeCutoff = nextDayShiftStartUTC;
        let overtimeHours = 0;
        if (effectiveCheckOutDateTime) {
          const cappedCheckout = effectiveCheckOutDateTime.getTime() > overtimeCutoff.getTime()
            ? overtimeCutoff
            : effectiveCheckOutDateTime;
          if (cappedCheckout.getTime() > overtimeStart.getTime()) {
            const overtimeMs = cappedCheckout.getTime() - overtimeStart.getTime();
            overtimeHours = Math.floor(overtimeMs / (1000 * 60 * 60));
          }
        }

        const extraNotes = extraNotesByKey.get(dateStr) || [];
        const recordCheckOut = hasOvernightStay ? null : checkOut;
        const compDaysFriday = 0;
        const compDaysOfficial = 0;
        records.push({
          id: recordId++,
          employeeCode: employee.code,
          date: dateStr,
          checkIn,
          checkOut: recordCheckOut,
          totalHours,
          status,
          overtimeHours,
          penalties,
          isOvernight: false,
          notes: composeDailyNotes({
            baseNotes: autoNotes || null,
            extraNotes,
            leaveNotes,
            hasOvernightStay,
          }),
          missionStart,
          missionEnd,
          halfDayExcused,
          isOfficialHoliday: false,
          workedOnOfficialHoliday: null,
          compDayCredit: 0,
          leaveDeductionDays: hasLeaveDeduction ? 1 : 0,
          excusedAbsenceDays: hasExcusedAbsence ? 1 : 0,
          terminationPeriodDays: 0,
          compDaysFriday,
          compDaysOfficial,
          compDaysTotal: compDaysFriday + compDaysOfficial,
          compDaysUsed: hasCompDayUsed ? 1 : 0,
        } as AttendanceRecord);
      } else {
        const extraNotes = extraNotesByKey.get(dateStr) || [];
        const status = hasExcusedAbsence ? "Excused Absence" : hasLeaveDeduction ? "Leave Deduction" : hasLeaveFromBalance || hasCompDayUsed ? "Leave" : "Absent";
        const penalties = hasExcusedAbsence || hasLeaveDeduction || hasLeaveFromBalance || hasCompDayUsed ? [] : [{ type: "غياب", value: 1 }];
        records.push({
          id: recordId++,
          employeeCode: employee.code,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          totalHours: 0,
          status,
          penalties,
          overtimeHours: 0,
          isOvernight: false,
          notes: composeDailyNotes({
            baseNotes: null,
            extraNotes,
            leaveNotes,
            hasOvernightStay,
          }),
          missionStart: null,
          missionEnd: null,
          halfDayExcused: false,
          isOfficialHoliday: false,
          workedOnOfficialHoliday: null,
          compDayCredit: 0,
          leaveDeductionDays: hasLeaveDeduction ? 1 : 0,
          excusedAbsenceDays: hasExcusedAbsence ? 1 : 0,
          terminationPeriodDays: 0,
          compDaysFriday: 0,
          compDaysOfficial: 0,
          compDaysTotal: 0,
          compDaysUsed: hasCompDayUsed ? 1 : 0,
        } as AttendanceRecord);
      }
    }
  }

  return records;
};

export const matchesRuleScope = (scope: string, employee: Employee) => {
  const normalizedEmployeeCode = String(employee.code ?? "").trim();
  return parseEmployeeScope(scope, employee, normalizedEmployeeCode);
};
