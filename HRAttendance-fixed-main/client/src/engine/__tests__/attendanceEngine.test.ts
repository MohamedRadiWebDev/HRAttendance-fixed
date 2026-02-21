import { describe, expect, it } from "vitest";
import { processAttendanceRecords } from "@/engine/attendanceEngine";
import { buildAttendanceExportRows } from "@/exporters/attendanceExport";
import { parseRuleScope } from "@shared/rule-scope";
import type { AttendanceRecord, BiometricPunch, Employee } from "@shared/schema";

const makeDate = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
};

const baseEmployee = (code = "E1"): Employee => ({
  id: 1,
  code,
  nameAr: "Tester",
  sector: "",
  department: "",
  section: "",
  jobTitle: "",
  branch: "",
  governorate: "",
  hireDate: "",
  terminationDate: "",
  terminationReason: "",
  serviceDuration: "",
  directManager: "",
  deptManager: "",
  nationalId: "",
  birthDate: "",
  address: "",
  birthPlace: "",
  personalPhone: "",
  emergencyPhone: "",
  shiftStart: "09:00",
});

describe("attendance engine", () => {
  it("handles lateness brackets", () => {
    const employee = baseEmployee();
    const punches: BiometricPunch[] = [
      { id: 1, employeeCode: employee.code, punchDatetime: makeDate("2024-06-03", "09:20") },
      { id: 2, employeeCode: employee.code, punchDatetime: makeDate("2024-06-03", "17:10") },
    ];

    const records = processAttendanceRecords({
      employees: [employee],
      punches,
      rules: [],
      leaves: [],
      adjustments: [],
      startDate: "2024-06-03",
      endDate: "2024-06-03",
      timezoneOffsetMinutes: 0,
    });

    expect(records[0]?.status).toBe("Late");
    expect(records[0]?.penalties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "تأخير", value: 0.25 }),
      ])
    );
  });

  it("applies early leave 0.5 penalty", () => {
    const employee = baseEmployee("E2");
    const punches: BiometricPunch[] = [
      { id: 1, employeeCode: employee.code, punchDatetime: makeDate("2024-06-04", "09:00") },
      { id: 2, employeeCode: employee.code, punchDatetime: makeDate("2024-06-04", "16:00") },
    ];

    const records = processAttendanceRecords({
      employees: [employee],
      punches,
      rules: [],
      leaves: [],
      adjustments: [],
      startDate: "2024-06-04",
      endDate: "2024-06-04",
      timezoneOffsetMinutes: 0,
    });

    expect(records[0]?.penalties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "انصراف مبكر", value: 0.5 }),
      ])
    );
  });

  it("applies missing stamp 0.5 penalty", () => {
    const employee = baseEmployee("E3");
    const punches: BiometricPunch[] = [
      { id: 1, employeeCode: employee.code, punchDatetime: makeDate("2024-06-05", "09:05") },
    ];

    const records = processAttendanceRecords({
      employees: [employee],
      punches,
      rules: [],
      leaves: [],
      adjustments: [],
      startDate: "2024-06-05",
      endDate: "2024-06-05",
      timezoneOffsetMinutes: 0,
    });

    expect(records[0]?.penalties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "سهو بصمة", value: 0.5 }),
      ])
    );
  });

  it("marks Friday as excused day", () => {
    const employee = baseEmployee("E4");
    const records = processAttendanceRecords({
      employees: [employee],
      punches: [],
      rules: [],
      leaves: [],
      adjustments: [],
      startDate: "2024-06-07",
      endDate: "2024-06-07",
      timezoneOffsetMinutes: 0,
    });

    expect(records[0]?.status).toBe("Friday");
  });

  it("uses Saturday 10-16 default shift", () => {
    const employee = baseEmployee("E5");
    const punches: BiometricPunch[] = [
      { id: 1, employeeCode: employee.code, punchDatetime: makeDate("2024-06-08", "09:50") },
      { id: 2, employeeCode: employee.code, punchDatetime: makeDate("2024-06-08", "16:10") },
    ];

    const records = processAttendanceRecords({
      employees: [employee],
      punches,
      rules: [],
      leaves: [],
      adjustments: [],
      startDate: "2024-06-08",
      endDate: "2024-06-08",
      timezoneOffsetMinutes: 0,
    });

    expect(records[0]?.status).not.toBe("Late");
    expect(records[0]?.penalties ?? []).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ type: "تأخير" })])
    );
  });

  it("parses multi-employee scope", () => {
    const scope = parseRuleScope("emp:289,31,515");
    expect(scope.type).toBe("emp");
    expect(scope.values).toEqual(["289", "31", "515"]);
  });

  it("counts absence as 2 in summary", () => {
    const record: AttendanceRecord = {
      id: 1,
      employeeCode: "EMP1",
      date: "2024-06-02",
      checkIn: null,
      checkOut: null,
      totalHours: 0,
      overtimeHours: 0,
      status: "Absent",
      penalties: [{ type: "غياب", value: 1 }],
      isOvernight: false,
      notes: null,
      missionStart: null,
      missionEnd: null,
      halfDayExcused: false,
    };

    const { summaryRows } = buildAttendanceExportRows({
      records: [record],
      employees: [baseEmployee("EMP1")],
    });

    const row = summaryRows[1];
    expect(row[8]).toBe(2);
  });
});
