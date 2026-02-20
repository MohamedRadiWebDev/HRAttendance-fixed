import { describe, expect, it } from "vitest";
import {
  buildAttendanceExportRows,
  calculateOnboardingDays,
  calculateTerminationPeriodDays,
  DETAIL_HEADERS,
  SUMMARY_HEADERS,
} from "@/exporters/attendanceExport";
import type { AttendanceRecord, Employee } from "@shared/schema";

const employee: Employee = {
  id: 1,
  code: "EMP1",
  nameAr: "موظف اختبار",
  sector: "",
  department: "",
  section: "القسم أ",
  jobTitle: "",
  branch: "",
  governorate: "",
  hireDate: "2024-06-02",
  terminationDate: "2024-06-04",
  terminationReason: "",
  serviceDuration: "",
  directManager: "",
  deptManager: "مدير أول",
  nationalId: "",
  birthDate: "",
  address: "",
  birthPlace: "",
  personalPhone: "",
  emergencyPhone: "",
  shiftStart: "09:00",
};

describe("export workbook checks", () => {
  it("keeps exact header order and maps row values by header", () => {
    const records: AttendanceRecord[] = [
      {
        id: 1,
        employeeCode: "EMP1",
        date: "2024-06-03",
        checkIn: new Date("2024-06-03T09:00:00"),
        checkOut: new Date("2024-06-03T17:00:00"),
        totalHours: 8,
        overtimeHours: 1,
        status: "Present",
        penalties: [{ type: "تأخير", value: 0.25 }] as any,
        isOvernight: false,
        notes: "مبيت",
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
      },
    ];

    const { detailHeaders, detailRows, summaryHeaders, summaryRows } = buildAttendanceExportRows({
      records,
      employees: [employee],
      reportStartDate: "2024-06-01",
      reportEndDate: "2024-06-10",
    });

    expect(detailHeaders).toEqual([...DETAIL_HEADERS]);
    expect(summaryHeaders).toEqual([...SUMMARY_HEADERS]);

    const detailCol = Object.fromEntries(detailHeaders.map((h, i) => [h, i])) as Record<string, number>;
    const summaryCol = Object.fromEntries(summaryHeaders.map((h, i) => [h, i])) as Record<string, number>;

    const detailFirst = detailRows[1];
    expect(detailFirst[detailCol["الكود"]]).toBe("EMP1");
    expect(detailFirst[detailCol["اسم الموظف"]]).toBe("موظف اختبار");
    expect(detailFirst[detailCol["القسم"]]).toBe("القسم أ");
    expect(detailFirst[detailCol["مدير الإدارة"]]).toBe("مدير أول");
    expect(typeof detailFirst[detailCol["فترة الالتحاق"]]).toBe("number");
    expect(typeof detailFirst[detailCol["فترة الترك"]]).toBe("number");

    const summaryFirst = summaryRows[1];
    expect(summaryFirst[summaryCol["الكود"]]).toBe("EMP1");
    expect(summaryFirst[summaryCol["اسم الموظف"]]).toBe("موظف اختبار");
    expect(summaryFirst[summaryCol["مدير الإدارة"]]).toBe("مدير أول");
    expect(summaryFirst[summaryCol["إجمالي الغياب"]]).toBe(0);
    expect(summaryFirst[summaryCol["إجمالي الجزاءات"]]).toBeGreaterThanOrEqual(0);

    const flat = JSON.stringify({ detailRows, summaryRows });
    expect(flat.includes("1970-01-01")).toBe(false);
  });

  it("calculates onboarding and termination periods and clamps to zero", () => {
    expect(calculateOnboardingDays("2025-02-09", "2025-02-01")).toBe(8);
    expect(calculateOnboardingDays("2025-02-01", "2025-02-01")).toBe(0);
    expect(calculateOnboardingDays("2025-01-20", "2025-02-01")).toBe(0);

    expect(calculateTerminationPeriodDays("2025-02-10", "2025-02-23")).toBe(13);
    expect(calculateTerminationPeriodDays("2025-02-23", "2025-02-23")).toBe(0);
    expect(calculateTerminationPeriodDays("2025-03-01", "2025-02-23")).toBe(0);
    expect(calculateTerminationPeriodDays("", "2025-02-23")).toBe(0);
  });
});
