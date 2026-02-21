import { z } from 'zod';
import { 
  insertEmployeeSchema, employees,
  insertTemplateSchema, excelTemplates,
  insertRuleSchema, specialRules,
  insertAdjustmentSchema, adjustments,
  insertAttendanceSchema, attendanceRecords,
  insertPunchSchema, biometricPunches,
  insertLeaveSchema, leaves
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  employees: {
    list: {
      method: 'GET' as const,
      path: '/api/employees',
      responses: {
        200: z.array(z.custom<typeof employees.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees',
      input: insertEmployeeSchema,
      responses: {
        201: z.custom<typeof employees.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/employees/:id',
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/employees/:id',
      input: insertEmployeeSchema.partial(),
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  rules: {
    list: {
      method: 'GET' as const,
      path: '/api/rules',
      responses: {
        200: z.array(z.custom<typeof specialRules.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/rules',
      input: insertRuleSchema,
      responses: {
        201: z.custom<typeof specialRules.$inferSelect>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/rules/:id',
      responses: {
        204: z.void(),
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/rules/:id',
      input: insertRuleSchema.partial(),
      responses: {
        200: z.custom<typeof specialRules.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },
  adjustments: {
    list: {
      method: 'GET' as const,
      path: '/api/adjustments',
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        employeeCode: z.string().optional(),
        type: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof adjustments.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/adjustments',
      input: insertAdjustmentSchema,
      responses: {
        201: z.custom<typeof adjustments.$inferSelect>(),
      },
    },
    import: {
      method: 'POST' as const,
      path: '/api/adjustments/import',
      input: z.object({
        sourceFileName: z.string().optional(),
        rows: z.array(z.object({
          rowIndex: z.number().optional(),
          employeeCode: z.string(),
          date: z.string(),
          type: z.string(),
          fromTime: z.string(),
          toTime: z.string(),
          source: z.string().optional(),
          sourceFileName: z.string().optional(),
          note: z.string().nullable().optional(),
        })),
      }),
      responses: {
        200: z.object({
          inserted: z.number(),
          invalid: z.array(z.object({
            rowIndex: z.number(),
            reason: z.string(),
          })),
        }),
        400: errorSchemas.validation,
      },
    },
  },
  leaves: {
    list: {
      method: 'GET' as const,
      path: '/api/leaves',
      responses: {
        200: z.array(z.custom<typeof leaves.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/leaves',
      input: insertLeaveSchema,
      responses: {
        201: z.custom<typeof leaves.$inferSelect>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/leaves/:id',
      responses: {
        204: z.void(),
      },
    },
    import: {
      method: 'POST' as const,
      path: '/api/leaves/import',
      input: z.object({
        rows: z.array(z.object({
          rowIndex: z.number().optional(),
          type: z.string(),
          scope: z.string(),
          scopeValue: z.string().optional(),
          startDate: z.string(),
          endDate: z.string(),
          note: z.string().optional(),
        })),
      }),
      responses: {
        200: z.object({
          inserted: z.number(),
          invalid: z.array(z.object({
            rowIndex: z.number(),
            reason: z.string(),
          })),
        }),
        400: errorSchemas.validation,
      },
    },
  },
  attendance: {
    list: {
      method: 'GET' as const,
      path: '/api/attendance',
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        employeeCode: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof attendanceRecords.$inferSelect>()),
      },
    },
    process: {
      method: 'POST' as const,
      path: '/api/attendance/process',
      input: z.object({
        startDate: z.string(),
        endDate: z.string(),
        timezoneOffsetMinutes: z.number().optional(),
      }),
      responses: {
        200: z.object({ message: z.string(), processedCount: z.number() }),
      },
    },
  },
  import: {
    punches: {
      method: 'POST' as const,
      path: '/api/import/punches',
      input: z.array(insertPunchSchema),
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
      },
    },
    employees: {
      method: 'POST' as const,
      path: '/api/import/employees',
      input: z.array(insertEmployeeSchema),
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
