import type { InsertAdjustment, InsertLeave } from "@shared/schema";
import { normalizeEmployeeCode } from "@shared/employee-code";
import { normalizeEffectType } from "@shared/effect-normalization";
import type { Effect } from "@/store/effectsStore";

export const applyEffectsToState = ({
  effects,
  adjustments,
  leaves,
}: {
  effects: Effect[];
  adjustments: any[];
  leaves: any[];
}) => {
  const adjustmentMap = new Map<string, any>();
  adjustments.forEach((adj) => adjustmentMap.set(`${normalizeEmployeeCode(adj.employeeCode)}__${adj.date}__${adj.type}__${adj.fromTime}__${adj.toTime}`, adj));
  const leaveMap = new Map<string, any>();
  leaves.forEach((leave) => leaveMap.set(`${leave.type}__${leave.scope}__${leave.scopeValue || ""}__${leave.startDate}__${leave.endDate}`, leave));

  let nextAdjustmentId = Math.max(0, ...adjustments.map((a) => a.id || 0)) + 1;
  let nextLeaveId = Math.max(0, ...leaves.map((l) => l.id || 0)) + 1;

  effects.forEach((effect) => {
    const employeeCode = normalizeEmployeeCode(effect.employeeCode);
    if (!employeeCode || !effect.date || !effect.type) return;

    const normalizedType = normalizeEffectType(effect.type);

    if (normalizedType === "اجازة رسمية" || normalizedType === "اجازة تحصيل") {
      const leaveRow: InsertLeave = {
        type: normalizedType === "اجازة رسمية" ? "official" : "collections",
        scope: "emp",
        scopeValue: employeeCode,
        startDate: effect.date,
        endDate: effect.date,
        note: effect.note || "",
        createdAt: new Date(),
      };
      const key = `${leaveRow.type}__${leaveRow.scope}__${leaveRow.scopeValue}__${leaveRow.startDate}__${leaveRow.endDate}`;
      if (!leaveMap.has(key)) leaveMap.set(key, { id: nextLeaveId++, ...leaveRow });
      return;
    }

    const adjustmentType = normalizedType === "اذن صباحي" ? "اذن صباحي" : normalizedType === "اذن مسائي" ? "اذن مسائي" : normalizedType;
    const adjustment: InsertAdjustment = {
      employeeCode,
      date: effect.date,
      fromTime: effect.fromTime || "00:00:00",
      toTime: effect.toTime || "00:00:00",
      type: adjustmentType as any,
      source: "effects_import",
      sourceFileName: "effects",
      importedAt: new Date(),
      note: [effect.note, effect.status ? `الحالة: ${effect.status}` : ""].filter(Boolean).join(" | "),
    };
    const key = `${adjustment.employeeCode}__${adjustment.date}__${adjustment.type}__${adjustment.fromTime}__${adjustment.toTime}`;
    if (!adjustmentMap.has(key)) adjustmentMap.set(key, { id: nextAdjustmentId++, ...adjustment });
  });

  const affectedDates = Array.from(new Set(effects.map((effect) => effect.date).filter(Boolean))).sort();
  const employeeCodes = Array.from(new Set(effects.map((effect) => normalizeEmployeeCode(effect.employeeCode)).filter(Boolean)));

  return {
    adjustments: Array.from(adjustmentMap.values()),
    leaves: Array.from(leaveMap.values()),
    affectedDates,
    employeeCodes,
  };
};
