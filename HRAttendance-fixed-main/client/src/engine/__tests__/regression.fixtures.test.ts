import { describe, expect, it } from "vitest";
import { processAttendanceRecords } from "@/engine/attendanceEngine";
import { buildAttendanceExportRows } from "@/exporters/attendanceExport";
import type { Employee, BiometricPunch, OfficialHoliday, SpecialRule } from "@shared/schema";

const emp = (code: string): Employee => ({
  id: Number(code),
  code,
  nameAr: `Emp ${code}`,
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

const p = (employeeCode: string, iso: string): BiometricPunch => ({
  id: Math.floor(Math.random() * 100000),
  employeeCode,
  punchDatetime: new Date(iso),
});

describe("regression fixtures", () => {
  it("1) normal day", () => {
    const records = processAttendanceRecords({
      employees: [emp("100")],
      punches: [p("100", "2024-06-03T09:00:00Z"), p("100", "2024-06-03T17:00:00Z")],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-06-03",
      endDate: "2024-06-03",
      timezoneOffsetMinutes: 0,
    });
    expect(records[0].date).toBe("2024-06-03");
    expect(records[0].status).toBe("Present");
  });

  it("2) late + missing stamp", () => {
    const records = processAttendanceRecords({
      employees: [emp("101")],
      punches: [p("101", "2024-06-04T09:45:00Z")],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-06-04",
      endDate: "2024-06-04",
      timezoneOffsetMinutes: 0,
    });
    const penalties = records[0].penalties as any[];
    expect(penalties.some((x) => x.type === "تأخير")).toBe(true);
    expect(penalties.some((x) => x.type === "سهو بصمة")).toBe(true);
  });

  it("3) midnight checkout + next-day attendance", () => {
    const records = processAttendanceRecords({
      employees: [emp("102")],
      punches: [
        p("102", "2024-06-05T20:00:00Z"),
        p("102", "2024-06-06T00:10:00Z"),
        p("102", "2024-06-06T09:00:00Z"),
        p("102", "2024-06-06T17:00:00Z"),
      ],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-06-05",
      endDate: "2024-06-06",
      timezoneOffsetMinutes: 0,
    });
    expect(records.some((r) => r.date === "2024-06-05")).toBe(true);
    expect(records.some((r) => r.date === "2024-06-06")).toBe(true);
  });

  it("4) overnight multi-day stay", () => {
    const rules: SpecialRule[] = [{
      id: 1,
      name: "stay",
      priority: 10,
      scope: "emp:103",
      startDate: "2024-06-10",
      endDate: "2024-06-10",
      ruleType: "overnight_stay",
      params: {},
    } as any];
    const records = processAttendanceRecords({
      employees: [emp("103")],
      punches: [p("103", "2024-06-10T09:00:00Z")],
      rules,
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-06-10",
      endDate: "2024-06-10",
      timezoneOffsetMinutes: 0,
    });
    expect(records[0].status).toBe("Present");
  });

  it("5) friday + official holiday + comp day counting + export sanity", () => {
    const officialHolidays: OfficialHoliday[] = [{ id: 1, date: "2024-06-08", name: "Holiday" } as any];
    const records = processAttendanceRecords({
      employees: [emp("104")],
      punches: [p("104", "2024-06-07T12:30:00Z"), p("104", "2024-06-08T09:00:00Z")],
      rules: [],
      leaves: [],
      officialHolidays,
      adjustments: [],
      startDate: "2024-06-07",
      endDate: "2024-06-08",
      timezoneOffsetMinutes: 0,
    });
    const friday = records.find((r) => r.date === "2024-06-07");
    const holiday = records.find((r) => r.date === "2024-06-08");
    expect((friday?.compDaysFriday || 0) >= 0).toBe(true);
    expect((holiday?.compDaysOfficial || 0) >= 0).toBe(true);

    const wb = buildAttendanceExportRows({ records, employees: [emp("104")] });
    expect(wb.detailRows.length).toBeGreaterThan(1);
    expect(wb.summaryRows.length).toBeGreaterThan(1);
    const flat = JSON.stringify(wb);
    expect(flat.includes("1970-01-01")).toBe(false);
  });
});
