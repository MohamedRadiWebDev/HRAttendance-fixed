import { useCallback, useState } from "react";
import { format } from "date-fns";
import { normalizeEmployeeCode } from "@shared/employee-code";
import { useAttendanceStore, type AttendanceStoreState } from "@/store/attendanceStore";
import type { AttendanceRecord } from "@shared/schema";

type AttendanceQuery = {
  data: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
};

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

const filterAttendanceRecords = (
  records: AttendanceRecord[],
  startDate?: string,
  endDate?: string,
  employeeCode?: string
) => {
  const codes = employeeCode?.includes(",")
    ? employeeCode.split(",").map((code) => normalizeEmployeeCode(code)).filter(Boolean)
    : employeeCode
      ? [normalizeEmployeeCode(employeeCode)]
      : [];

  return records.filter((record) => {
    if (startDate && record.date < startDate) return false;
    if (endDate && record.date > endDate) return false;
    if (codes.length > 0 && !codes.includes(normalizeEmployeeCode(record.employeeCode))) return false;
    return true;
  });
};

export function useAttendanceRecords(
  startDate?: string,
  endDate?: string,
  employeeCode?: string,
  page: number = 1,
  limit: number = 0,
  useDefaultRange: boolean = true
) {
  const now = new Date();
  const defaultStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const defaultEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const effectiveStart = useDefaultRange ? (startDate || defaultStart) : startDate;
  const effectiveEnd = useDefaultRange ? (endDate || defaultEnd) : endDate;

  const attendanceRecords = useAttendanceStore((state: AttendanceStoreState) => state.attendanceRecords);
  const filtered = filterAttendanceRecords(attendanceRecords, effectiveStart, effectiveEnd, employeeCode);

  const sorted = [...filtered].sort((a, b) => {
    if (a.date === b.date) return (b.id ?? 0) - (a.id ?? 0);
    return b.date.localeCompare(a.date);
  });

  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const offset = safeLimit > 0 ? (safePage - 1) * safeLimit : 0;
  const data = safeLimit > 0 ? sorted.slice(offset, offset + safeLimit) : sorted;

  return {
    data: {
      data,
      total: sorted.length,
      page: safePage,
      limit: safeLimit,
    } as AttendanceQuery,
    isLoading: false,
  };
}

export function useProcessAttendance() {
  const processAttendance = useAttendanceStore((state: AttendanceStoreState) => state.processAttendance);
  return useStoreMutation<{ startDate: string; endDate: string; timezoneOffsetMinutes?: number; employeeCodes?: string[] }, { message: string; processedCount: number }>(
    processAttendance
  );
}

export function useImportPunches() {
  const importPunches = useAttendanceStore((state: AttendanceStoreState) => state.importPunches);
  return useStoreMutation<any[], { count: number }>(importPunches);
}

export function useUpdateAttendanceRecord() {
  const updateAttendanceRecord = useAttendanceStore((state: AttendanceStoreState) => state.updateAttendanceRecord);
  return useStoreMutation<{ id: number; updates: Partial<AttendanceRecord> }, void>(({ id, updates }) => {
    updateAttendanceRecord(id, updates);
  });
}
