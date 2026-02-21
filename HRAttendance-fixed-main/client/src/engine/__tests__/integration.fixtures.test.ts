import { describe, expect, it } from "vitest";
import normal from "@/fixtures/normal-day.json";
import late from "@/fixtures/late-early-missing.json";
import midnight from "@/fixtures/midnight-next-day.json";
import stay from "@/fixtures/overnight-stay.json";
import fh from "@/fixtures/friday-holiday-termination.json";
import { processAttendanceRecords } from "@/engine/attendanceEngine";
import type { Employee, OfficialHoliday, SpecialRule } from "@shared/schema";

const toEmployee = (row: any): Employee => ({
  id: Number(row.code),
  code: row.code,
  nameAr: `Emp ${row.code}`,
  sector: "",
  department: "",
  section: "",
  jobTitle: "",
  branch: "",
  governorate: "",
  hireDate: "",
  terminationDate: row.terminationDate || "",
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
  shiftStart: row.shiftStart || "09:00",
});

const toPunches = (employeeCode: string, rows: string[]) => rows.map((iso, i) => ({ id: i + 1, employeeCode, punchDatetime: new Date(iso) }));

describe("integration fixtures", () => {
  it("normal day fixture", () => {
    const e = toEmployee(normal.employees[0]);
    const records = processAttendanceRecords({ employees: [e], punches: toPunches(e.code, normal.punches), startDate: "2024-06-03", endDate: "2024-06-03" } as any);
    expect(records[0].status).toBe(normal.expected.status);
  });

  it("late+missing fixture", () => {
    const e = toEmployee(late.employees[0]);
    const records = processAttendanceRecords({ employees: [e], punches: toPunches(e.code, late.punches), startDate: "2024-06-04", endDate: "2024-06-04" } as any);
    const penalties = records[0].penalties as any[];
    expect(penalties.some((x) => x.type === "تأخير")).toBe(true);
    expect(penalties.some((x) => x.type === "سهو بصمة")).toBe(true);
  });

  it("midnight fixture keeps both dates", () => {
    const e = toEmployee(midnight.employees[0]);
    const records = processAttendanceRecords({ employees: [e], punches: toPunches(e.code, midnight.punches), startDate: "2024-06-05", endDate: "2024-06-06", timezoneOffsetMinutes: 0 } as any);
    expect(records.some((r) => r.date === midnight.expected.dates[0])).toBe(true);
    expect(records.some((r) => r.date === midnight.expected.dates[1])).toBe(true);
    const nextDay = records.find((r) => r.date === midnight.expected.dates[1]);
    expect(nextDay?.checkIn).not.toBeNull();
  });

  it("overnight stay fixture", () => {
    const e = toEmployee(stay.employees[0]);
    const rules: SpecialRule[] = [{ id: 1, name: "stay", priority: 10, scope: stay.rules[0].scope, startDate: stay.rules[0].startDate, endDate: stay.rules[0].endDate, ruleType: "overnight_stay", params: {} } as any];
    const records = processAttendanceRecords({ employees: [e], punches: toPunches(e.code, stay.punches), rules, startDate: "2024-06-10", endDate: "2024-06-11" } as any);
    expect(records.length).toBe(2);
    expect(records[0].status).toBe(stay.expected.statuses[0]);
    expect(records[1].status).toBe(stay.expected.statuses[1]);
  });

  it("friday+holiday+termination fixture", () => {
    const e = toEmployee(fh.employees[0]);
    const officialHolidays: OfficialHoliday[] = fh.officialHolidays as any;
    const records = processAttendanceRecords({ employees: [e], punches: toPunches(e.code, fh.punches), officialHolidays, startDate: "2024-06-07", endDate: "2024-06-09", timezoneOffsetMinutes: 0 } as any);
    expect(records.some((r) => r.date === "2024-06-07")).toBe(true);
    expect(records.some((r) => r.date === "2024-06-08")).toBe(true);
    const term = records.find((r) => r.status === "Termination Period");
    expect(term).toBeDefined();
    expect(term?.leaveDeductionDays).toBe(1);
    expect((term?.penalties as any[] | undefined)?.some((p) => p.type === "غياب")).toBe(false);
  });

  it("effect adjustment changes day output", () => {
    const e = toEmployee({ code: "701", shiftStart: "09:00" });
    const punches = toPunches(e.code, ["2024-06-12T10:00:00", "2024-06-12T17:00:00"]);

    const withoutAdjustment = processAttendanceRecords({
      employees: [e],
      punches,
      startDate: "2024-06-12",
      endDate: "2024-06-12",
      timezoneOffsetMinutes: 0,
    } as any);

    const withAdjustment = processAttendanceRecords({
      employees: [e],
      punches,
      adjustments: [
        {
          id: 1,
          employeeCode: "701",
          date: "2024-06-12",
          fromTime: "09:00:00",
          toTime: "10:00:00",
          type: "اذن صباحي",
          source: "test",
          sourceFileName: "fixture",
          importedAt: new Date(),
          note: null,
        },
      ],
      startDate: "2024-06-12",
      endDate: "2024-06-12",
      timezoneOffsetMinutes: 0,
    } as any);

    const withoutLate = (withoutAdjustment[0].penalties as any[]).filter((p) => p.type === "تأخير").reduce((sum, p) => sum + Number(p.value || 0), 0);
    const withLate = (withAdjustment[0].penalties as any[]).filter((p) => p.type === "تأخير").reduce((sum, p) => sum + Number(p.value || 0), 0);

    expect(withoutLate).toBeGreaterThan(0);
    expect(withLate).toBe(0);
  });


  it("effect morning permission without times suppresses late penalty", () => {
    const e = toEmployee({ code: "648", shiftStart: "09:00" });
    const punches = toPunches(e.code, ["2024-06-13T09:30:00", "2024-06-13T17:00:00"]);

    const withoutEffect = processAttendanceRecords({
      employees: [e],
      punches,
      startDate: "2024-06-13",
      endDate: "2024-06-13",
      timezoneOffsetMinutes: 0,
    } as any);

    const withEffect = processAttendanceRecords({
      employees: [e],
      punches,
      effects: [
        {
          employeeCode: "648",
          date: "2024-06-13",
          type: "إذن صباحي",
          fromTime: "",
          toTime: "",
          source: "excel",
        },
      ],
      startDate: "2024-06-13",
      endDate: "2024-06-13",
      timezoneOffsetMinutes: 0,
      defaultPermissionMinutes: 120,
    } as any);

    const withoutLate = (withoutEffect[0].penalties as any[]).filter((p) => p.type === "تأخير").reduce((sum, p) => sum + Number(p.value || 0), 0);
    const withLate = (withEffect[0].penalties as any[]).filter((p) => p.type === "تأخير").reduce((sum, p) => sum + Number(p.value || 0), 0);

    expect(withoutLate).toBeGreaterThan(0);
    expect(withLate).toBe(0);
  });


  it("mission effect suppresses penalties for covered window", () => {
    const e = toEmployee({ code: "900", shiftStart: "09:00" });
    const punches = toPunches(e.code, ["2024-06-13T09:00:00", "2024-06-13T15:00:00"]);

    const withoutEffect = processAttendanceRecords({
      employees: [e],
      punches,
      startDate: "2024-06-13",
      endDate: "2024-06-13",
      timezoneOffsetMinutes: 0,
    } as any);

    const withMission = processAttendanceRecords({
      employees: [e],
      punches,
      effects: [
        {
          employeeCode: "900",
          date: "2024-06-13",
          type: "مأمورية",
          fromTime: "09:00",
          toTime: "17:00",
          source: "excel",
        },
      ],
      startDate: "2024-06-13",
      endDate: "2024-06-13",
      timezoneOffsetMinutes: 0,
    } as any);

    const penaltiesWithout = (withoutEffect[0].penalties as any[]).reduce((sum, p) => sum + Number(p.value || 0), 0);
    const penaltiesWith = (withMission[0].penalties as any[]).reduce((sum, p) => sum + Number(p.value || 0), 0);

    expect(penaltiesWithout).toBeGreaterThan(0);
    expect(penaltiesWith).toBe(0);
  });

});
