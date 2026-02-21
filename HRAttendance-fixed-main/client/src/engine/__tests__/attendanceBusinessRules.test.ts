import { describe, expect, it } from "vitest";
import { processAttendanceRecords } from "@/engine/attendanceEngine";
import { buildAttendanceExportRows } from "@/exporters/attendanceExport";
import type { Adjustment, Employee, OfficialHoliday } from "@shared/schema";

const baseEmployee: Employee = {
  id: 1,
  code: "101",
  nameAr: "أحمد محمود",
  sector: null,
  department: null,
  section: null,
  jobTitle: null,
  branch: null,
  governorate: null,
  hireDate: null,
  terminationDate: null,
  terminationReason: null,
  serviceDuration: null,
  directManager: null,
  deptManager: null,
  nationalId: null,
  birthDate: null,
  address: null,
  birthPlace: null,
  personalPhone: null,
  emergencyPhone: null,
  shiftStart: "09:00",
};

const buildAdjustment = (date: string, type: Adjustment["type"]): Adjustment => ({
  id: 1,
  employeeCode: "101",
  date,
  type,
  fromTime: "00:00",
  toTime: "23:59",
  source: "manual",
  sourceFileName: null,
  importedAt: new Date(),
  note: null,
});

describe("attendance business rules", () => {
  it("marks absent day as غياب and summary weights it by 2", () => {
    const records = processAttendanceRecords({
      employees: [baseEmployee],
      punches: [],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-03-04",
      endDate: "2024-03-04",
    });
    expect(records[0].status).toBe("Absent");
    expect(records[0].penalties?.length).toBeGreaterThan(0);

    const { summaryRows } = buildAttendanceExportRows({ records, employees: [baseEmployee] });
    expect(summaryRows[1][13]).toBe(2); // weighted absence total
  });

  it("marks غياب بعذر with weight 1 and no penalties", () => {
    const records = processAttendanceRecords({
      employees: [baseEmployee],
      punches: [],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [buildAdjustment("2024-03-04", "غياب بعذر")],
      startDate: "2024-03-04",
      endDate: "2024-03-04",
    });
    expect(records[0].status).toBe("Excused Absence");
    expect(records[0].excusedAbsenceDays).toBe(1);
    expect(records[0].penalties?.length).toBe(0);

    const { summaryRows } = buildAttendanceExportRows({ records, employees: [baseEmployee] });
    expect(summaryRows[1][13]).toBe(0); // excused absence not counted as weighted غياب
  });

  it("marks إجازة بالخصم with deduction and no penalties", () => {
    const records = processAttendanceRecords({
      employees: [baseEmployee],
      punches: [],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [buildAdjustment("2024-03-04", "إجازة بالخصم")],
      startDate: "2024-03-04",
      endDate: "2024-03-04",
    });
    expect(records[0].status).toBe("Leave Deduction");
    expect(records[0].leaveDeductionDays).toBe(1);
    expect(records[0].penalties?.length).toBe(0);
  });

  it("counts إجازة بدل as used comp day and suppresses absence penalties", () => {
    const records = processAttendanceRecords({
      employees: [baseEmployee],
      punches: [],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [buildAdjustment("2024-03-04", "إجازة بدل")],
      startDate: "2024-03-04",
      endDate: "2024-03-04",
    });
    expect(records[0].status).toBe("Leave");
    expect(records[0].penalties?.length).toBe(0);
    expect(records[0].compDaysUsed).toBe(1);
  });

  it("treats days after termination date as فترة ترك", () => {
    const employee = { ...baseEmployee, terminationDate: "2024-03-04" };
    const records = processAttendanceRecords({
      employees: [employee],
      punches: [],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-03-04",
      endDate: "2024-03-05",
    });
    expect(records[1].status).toBe("Termination Period");
    expect(records[1].terminationPeriodDays).toBe(1);
    expect(records[1].leaveDeductionDays).toBe(1);
  });


  it("marks days before hire date as joining period without absence penalties", () => {
    const employee = { ...baseEmployee, hireDate: "2024-02-06" };
    const records = processAttendanceRecords({
      employees: [employee],
      punches: [],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-01-23",
      endDate: "2024-02-09",
    });

    const preHire = records.find((row) => row.date === "2024-02-05");
    expect(preHire?.status).toBe("Joining Period");
    expect(preHire?.penalties).toEqual([]);

    const { summaryRows, summaryHeaders } = buildAttendanceExportRows({
      records,
      employees: [employee],
      reportStartDate: "2024-01-23",
      reportEndDate: "2024-02-09",
    });
    const postHireOnly = processAttendanceRecords({
      employees: [employee],
      punches: [],
      rules: [],
      leaves: [],
      officialHolidays: [],
      adjustments: [],
      startDate: "2024-02-06",
      endDate: "2024-02-09",
    });
    const postHireSummary = buildAttendanceExportRows({
      records: postHireOnly,
      employees: [employee],
      reportStartDate: "2024-02-06",
      reportEndDate: "2024-02-09",
    });

    const col = Object.fromEntries(summaryHeaders.map((h, i) => [h, i])) as Record<string, number>;
    const postCol = Object.fromEntries(postHireSummary.summaryHeaders.map((h, i) => [h, i])) as Record<string, number>;
    expect(summaryRows[1][col["فترة الالتحاق"]]).toBe(14);
    expect(summaryRows[1][col["إجمالي الغياب"]]).toBe(postHireSummary.summaryRows[1][postCol["إجمالي الغياب"]]);
    expect(summaryRows[1][col["إجمالي الجزاءات"]]).toBe(postHireSummary.summaryRows[1][postCol["إجمالي الجزاءات"]]);
  });

  it("counts comp days for Friday and official holidays when worked", () => {
    const punches = [
      {
        id: 1,
        employeeCode: "101",
        punchDatetime: new Date("2024-03-01T12:00:00Z"),
      },
      {
        id: 2,
        employeeCode: "101",
        punchDatetime: new Date("2024-03-02T12:00:00Z"),
      },
    ];
    const officialHolidays: OfficialHoliday[] = [{ id: 1, date: "2024-03-02", name: "إجازة" }];
    const records = processAttendanceRecords({
      employees: [baseEmployee],
      punches,
      rules: [],
      leaves: [],
      officialHolidays,
      adjustments: [],
      startDate: "2024-03-01",
      endDate: "2024-03-02",
    });
    const fridayRecord = records.find((record) => record.date === "2024-03-01");
    const holidayRecord = records.find((record) => record.date === "2024-03-02");
    expect(fridayRecord?.compDaysFriday).toBe(1);
    expect(holidayRecord?.compDaysOfficial).toBe(1);
  });
});
