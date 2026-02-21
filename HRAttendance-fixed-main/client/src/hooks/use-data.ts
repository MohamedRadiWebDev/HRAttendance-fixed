import { useCallback, useState } from "react";
import { normalizeEmployeeCode } from "@shared/employee-code";
import type { InsertAdjustment, InsertLeave, InsertOfficialHoliday, InsertSpecialRule, InsertTemplate } from "@shared/schema";
import { useAttendanceStore, type AttendanceStoreState } from "@/store/attendanceStore";

const useStoreMutation = <TInput, TResult>(
  action: (input: TInput) => TResult
) => {
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(
    (input: TInput, options?: { onSuccess?: (data: TResult) => void; onError?: (error: any) => void }) => {
      setIsPending(true);
      try {
        const result = action(input);
        options?.onSuccess?.(result);
      } catch (error) {
        options?.onError?.(error);
      } finally {
        setIsPending(false);
      }
    },
    [action]
  );

  const mutateAsync = useCallback(
    async (input: TInput) => {
      setIsPending(true);
      try {
        return action(input);
      } finally {
        setIsPending(false);
      }
    },
    [action]
  );

  return { mutate, mutateAsync, isPending };
};

export function useRules() {
  const rules = useAttendanceStore((state: AttendanceStoreState) => state.rules);
  return { data: rules, isLoading: false };
}

export function useCreateRule() {
  const createRule = useAttendanceStore((state: AttendanceStoreState) => state.createRule);
  return useStoreMutation<InsertSpecialRule, any>(createRule);
}

export function useDeleteRule() {
  const deleteRule = useAttendanceStore((state: AttendanceStoreState) => state.deleteRule);
  return useStoreMutation<number, void>(deleteRule);
}

export function useUpdateRule() {
  const updateRule = useAttendanceStore((state: AttendanceStoreState) => state.updateRule);
  return useStoreMutation<{ id: number; rule: Partial<InsertSpecialRule> }, any>(({ id, rule }) => {
    return updateRule(id, rule);
  });
}

export function useImportRules() {
  const importRules = useAttendanceStore((state: AttendanceStoreState) => state.importRules);
  return useStoreMutation<InsertSpecialRule[], { count: number }>(importRules);
}

export function useAdjustments(filters?: { startDate?: string; endDate?: string; employeeCode?: string; type?: string }) {
  const adjustments = useAttendanceStore((state: AttendanceStoreState) => state.adjustments);
  const filtered = adjustments.filter((adj) => {
    if (filters?.startDate && adj.date < filters.startDate) return false;
    if (filters?.endDate && adj.date > filters.endDate) return false;
    if (filters?.employeeCode && normalizeEmployeeCode(adj.employeeCode) !== normalizeEmployeeCode(filters.employeeCode)) return false;
    if (filters?.type && adj.type !== filters.type) return false;
    return true;
  });
  return { data: filtered, isLoading: false };
}

export function useCreateAdjustment() {
  const createAdjustment = useAttendanceStore((state: AttendanceStoreState) => state.createAdjustment);
  return useStoreMutation<InsertAdjustment, any>(createAdjustment);
}

export function useImportAdjustments() {
  const importAdjustments = useAttendanceStore((state: AttendanceStoreState) => state.importAdjustments);
  return useStoreMutation<{ sourceFileName?: string; rows: InsertAdjustment[] }, { inserted: number; invalid: { rowIndex?: number; reason?: string }[] }>(
    ({ rows }) => importAdjustments(rows)
  );
}

export function useTemplates() {
  return { data: [], isLoading: false };
}

export function useCreateTemplate() {
  return useStoreMutation<InsertTemplate, any>(() => {
    throw new Error("Templates are not available in frontend-only mode");
  });
}

export function useDeleteTemplate() {
  return useStoreMutation<number, void>(() => {
    throw new Error("Templates are not available in frontend-only mode");
  });
}

export function useLeaves() {
  const leaves = useAttendanceStore((state: AttendanceStoreState) => state.leaves);
  return { data: leaves, isLoading: false };
}

export function useOfficialHolidays() {
  const officialHolidays = useAttendanceStore((state: AttendanceStoreState) => state.officialHolidays);
  return { data: officialHolidays, isLoading: false };
}

export function useCreateOfficialHoliday() {
  const createOfficialHoliday = useAttendanceStore((state: AttendanceStoreState) => state.createOfficialHoliday);
  return useStoreMutation<InsertOfficialHoliday, any>(createOfficialHoliday);
}

export function useDeleteOfficialHoliday() {
  const deleteOfficialHoliday = useAttendanceStore((state: AttendanceStoreState) => state.deleteOfficialHoliday);
  return useStoreMutation<number, void>(deleteOfficialHoliday);
}

export function useCreateLeave() {
  const createLeave = useAttendanceStore((state: AttendanceStoreState) => state.createLeave);
  return useStoreMutation<InsertLeave, any>(createLeave);
}

export function useDeleteLeave() {
  const deleteLeave = useAttendanceStore((state: AttendanceStoreState) => state.deleteLeave);
  return useStoreMutation<number, void>(deleteLeave);
}

export function useImportLeaves() {
  const importLeaves = useAttendanceStore((state: AttendanceStoreState) => state.importLeaves);
  return useStoreMutation<{ rows: InsertLeave[] }, { inserted: number; invalid: { rowIndex?: number; reason?: string }[] }>(({ rows }) => importLeaves(rows));
}
