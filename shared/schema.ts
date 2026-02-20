import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const LEAVE_TYPES = ["annual", "sick", "unpaid", "mission", "permission"] as const;
export const ADJUSTMENT_TYPES = ["اذن صباحي", "اذن مسائي", "إجازة نص يوم", "مأمورية", "إجازة بالخصم", "غياب بعذر", "إجازة من الرصيد", "إجازة بدل"] as const;
export const RULE_TYPES = ["custom_shift", "attendance_exempt", "penalty_override", "ignore_biometric", "overtime_overnight", "overnight_stay"] as const;
export const PENALTY_TYPES = ["late_arrival", "early_leave", "missing_stamp", "absence"] as const;

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  sector: text("sector"),
  department: text("department"),
  section: text("section"),
  jobTitle: text("job_title"),
  branch: text("branch"),
  governorate: text("governorate"),
  hireDate: text("hire_date"),
  terminationDate: text("termination_date"),
  terminationReason: text("termination_reason"),
  serviceDuration: text("service_duration"),
  directManager: text("direct_manager"),
  deptManager: text("dept_manager"),
  nationalId: text("national_id"),
  birthDate: text("birth_date"),
  address: text("address"),
  birthPlace: text("birth_place"),
  personalPhone: text("personal_phone"),
  emergencyPhone: text("emergency_phone"),
  shiftStart: text("shift_start").default("09:00"),
});

export const biometricPunches = pgTable("biometric_punches", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull(),
  punchDatetime: timestamp("punch_datetime").notNull(),
});

export const excelTemplates = pgTable("excel_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'attendance' or 'summary'
  mapping: jsonb("mapping").notNull(), // Column definitions
});

export const specialRules = pgTable("special_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  priority: integer("priority").default(0),
  scope: text("scope").notNull(), // 'all', 'dept:Sales', 'emp:123'
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  ruleType: text("rule_type", { enum: RULE_TYPES }).notNull(),
  params: jsonb("params").notNull(),
});

export const adjustments = pgTable(
  "adjustments",
  {
    id: serial("id").primaryKey(),
    employeeCode: text("employee_code").notNull(),
    date: text("date").notNull(),
    type: text("type", { enum: ADJUSTMENT_TYPES }).notNull(),
    fromTime: text("from_time").notNull(),
    toTime: text("to_time").notNull(),
    source: text("source").notNull(),
    sourceFileName: text("source_file_name"),
    importedAt: timestamp("imported_at").defaultNow(),
    note: text("note"),
  },
  (table) => ({
    adjustmentUnique: uniqueIndex("adjustments_unique_idx").on(
      table.employeeCode,
      table.date,
      table.type,
      table.fromTime,
      table.toTime,
      table.source
    ),
  })
);

// Storing calculated attendance for performance
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  totalHours: doublePrecision("total_hours").default(0),
  overtimeHours: doublePrecision("overtime_hours").default(0),
  status: text("status"), // Present, Absent, Late, etc.
  penalties: jsonb("penalties"), // Array of penalty objects
  isOvernight: boolean("is_overnight").default(false),
  notes: text("notes"),
  missionStart: text("mission_start"),
  missionEnd: text("mission_end"),
  halfDayExcused: boolean("half_day_excused").default(false),
  isOfficialHoliday: boolean("is_official_holiday").default(false),
  workedOnOfficialHoliday: boolean("worked_on_official_holiday"),
  compDayCredit: doublePrecision("comp_day_credit").default(0),
  leaveDeductionDays: doublePrecision("leave_deduction_days").default(0),
  excusedAbsenceDays: doublePrecision("excused_absence_days").default(0),
  terminationPeriodDays: doublePrecision("termination_period_days").default(0),
  compDaysFriday: doublePrecision("comp_days_friday").default(0),
  compDaysOfficial: doublePrecision("comp_days_official").default(0),
  compDaysTotal: doublePrecision("comp_days_total").default(0),
  compDaysUsed: doublePrecision("comp_days_used").default(0),
});

export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // official | collections
  scope: text("scope").notNull(), // all | sector | department | section | branch | emp
  scopeValue: text("scope_value"),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const officialHolidays = pgTable("official_holidays", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  name: text("name").notNull(),
});


// Zod Schemas
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertPunchSchema = createInsertSchema(biometricPunches).omit({ id: true });
export const insertTemplateSchema = createInsertSchema(excelTemplates).omit({ id: true });
export const insertRuleSchema = createInsertSchema(specialRules).omit({ id: true });
export const insertAdjustmentSchema = createInsertSchema(adjustments).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({ id: true });
export const insertLeaveSchema = createInsertSchema(leaves).omit({ id: true });
export const insertOfficialHolidaySchema = createInsertSchema(officialHolidays).omit({ id: true });

// Types
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Template = typeof excelTemplates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

export type SpecialRule = typeof specialRules.$inferSelect;
export type InsertSpecialRule = z.infer<typeof insertRuleSchema>;

export type Adjustment = typeof adjustments.$inferSelect;
export type InsertAdjustment = z.infer<typeof insertAdjustmentSchema>;

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceSchema>;

export type Leave = typeof leaves.$inferSelect;
export type InsertLeave = z.infer<typeof insertLeaveSchema>;

export type BiometricPunch = typeof biometricPunches.$inferSelect;
export type InsertBiometricPunch = z.infer<typeof insertPunchSchema>;

export type OfficialHoliday = typeof officialHolidays.$inferSelect;
export type InsertOfficialHoliday = z.infer<typeof insertOfficialHolidaySchema>;
