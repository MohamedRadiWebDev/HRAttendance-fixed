import { useCallback, useState } from "react";
import type { InsertEmployee } from "@shared/schema";
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

export function useEmployees() {
  const employees = useAttendanceStore((state: AttendanceStoreState) => state.employees);
  return { data: employees, isLoading: false };
}

export function useEmployee(id: number) {
  const employee = useAttendanceStore((state: AttendanceStoreState) => state.employees.find((item) => item.id === id) ?? null);
  return { data: employee, isLoading: false };
}

export function useCreateEmployee() {
  const createEmployee = useAttendanceStore((state: AttendanceStoreState) => state.createEmployee);
  return useStoreMutation<InsertEmployee, any>(createEmployee);
}

export function useUpdateEmployee() {
  const updateEmployee = useAttendanceStore((state: AttendanceStoreState) => state.updateEmployee);
  return useStoreMutation<{ id: number } & Partial<InsertEmployee>, any>(({ id, ...data }) => {
    return updateEmployee(id, data);
  });
}

export function useImportEmployees() {
  const importEmployees = useAttendanceStore((state: AttendanceStoreState) => state.importEmployees);
  return useStoreMutation<InsertEmployee[], { count: number }>(importEmployees);
}

export function useImportPunches() {
  const importPunches = useAttendanceStore((state: AttendanceStoreState) => state.importPunches);
  return useStoreMutation<any[], { count: number }>(importPunches);
}
