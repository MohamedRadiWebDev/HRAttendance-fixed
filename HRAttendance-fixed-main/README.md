# HR Attendance & Payroll Web App (الحضور والانصراف والرواتب)

A production-oriented Arabic-first HR attendance application built with **React + Vite + TypeScript**. It imports biometric punch files (البصمة), applies business rules (rules / adjustments / leaves), calculates attendance outcomes, and exports payroll-ready Excel reports with **تفصيلي** and **ملخص** sheets.  

> **Important reality check (based on current repo):** this repository is currently a **frontend-only implementation** (no active Express server code in repo). Data is persisted in browser storage (localStorage + IndexedDB), while `shared/schema.ts`, `shared/routes.ts`, and `drizzle.config.ts` define a PostgreSQL/Drizzle contract you can use if/when you add a backend.

---

## 1) Features

- Arabic RTL UI across all core flows.
- Employee master data management (الموظفين).
- Biometric import from Excel with flexible header matching (Arabic/English variants).
- Attendance processing engine with deterministic rules for:
  - late arrival (تأخير)
  - early leave (انصراف مبكر)
  - missing stamp (سهو بصمة)
  - absence (غياب)
  - mission/permission/half-day/leave adjustments
  - Friday handling (جمعة)
  - official holiday handling (إجازة رسمية) + comp day credits
  - overnight edge cases (post-midnight punches, overnight stay rules)
- Rules engine with scope parsing (`all`, `emp:`, `dept:`, `sector:`).
- Bulk effects import (المؤثرات) with validation table + auto-apply workflow.
- Excel exports:
  - Detailed attendance sheet (**تفصيلي**)
  - Summary sheet (**ملخص**)
- Backup/restore (zip payload, selective modules).
- Client-side persistence with compatibility guards and corruption fallback.

---

## 2) Screens / Pages

- `/` **Dashboard**: high-level metrics, date-range controls, quick backup integration.
- `/employees` **Employees**: employee CRUD + Excel template/export helpers.
- `/attendance` **Attendance**: process records, inspect results, export reports.
- `/attendance-heatmap` **Attendance Heatmap**: visual distribution view.
- `/import` **Import**: upload punches/employees, preview, import, auto-process attendance range.
- `/rules` **Rules**: configure special rules and import/export rules via Excel.
- `/adjustments` **Adjustments**: manual adjustments listing and add dialog.
- `/bulk-adjustments` and `/effects-import` **Bulk Adjustments Import**: unified effects import (missions/permissions/leaves-like effects).
- `/leaves` **Leaves**: leave definitions/scopes and holiday-related setup.
- `/backup` **Backup & Restore**: zip export/import with merge/replace modes.

---

## 3) Business Rules Summary (ملخص قواعد الأعمال)

### Core calculations

- **Grace period**: 15 minutes before late/early penalties apply.
- **Late penalty (تأخير)**:
  - 16–30 min → `0.25`
  - 31–60 min → `0.5`
  - >60 min → `1`
- **Early leave penalty (انصراف مبكر)**: `0.5` when checkout is before shift-end threshold (unless excused).
- **Missing stamp (سهو بصمة)**: `0.5` when check-in exists without checkout (unless excused).
- **Absence (غياب)**: base penalty recorded as `1` in daily penalties; summary math treats absence as weighted value (`×2`) in summary totals.

### Special days

- **Friday (جمعة)**:
  - Default is non-working day status (`Friday`) unless attended within configured Friday windows.
  - Attendance on Friday can grant comp-day credits (`compDaysFriday`).
- **Official holiday (إجازة رسمية)**:
  - If employee worked (or mission/punch detected), comp credit is granted (`compDaysOfficial`).
  - Supports manual override (`workedOnOfficialHoliday`) from UI workflow.
- **Termination period (فترة الترك)**:
  - Dates after termination date are marked as termination period with deduction behavior.

### Adjustments/effects logic

Supported imported effect types include:  
`مأمورية`, `إذن صباحي`, `إذن مسائي`, `إذن (عام)`, `إجازة نصف يوم`, `إجازة من الرصيد`, `إجازة بالخصم`, `إجازة رسمية`, `إجازة تحصيل`, `غياب بعذر`.

Auto-fill/auto-infer is applied for missing times for specific types (e.g., morning/evening permissions, half-day).

---

## 4) Data Flow & Workflow A→Z

## Data Flow

1. User imports source Excel (employees or punches or effects).  
2. File is parsed in browser (`xlsx`) and normalized.  
3. Data is written into Zustand stores.  
4. Store persistence writes:
   - structured app state to localStorage
   - punch history to IndexedDB (with fallback to localStorage)
5. Attendance engine processes date range into `attendanceRecords`.  
6. Exporters transform records into Excel rows (تفصيلي + ملخص).  
7. User downloads report via `XLSX.writeFile`.

## Workflow A→Z

1. Load employee master data (الموظفين).
2. Import biometric punches (البصمة).
3. Configure optional rules (قواعد) and leaves/holidays (إجازات).
4. Add manual adjustments/effects if needed.
5. Run attendance processing on date range.
6. Review attendance grid and notes.
7. Export detailed + summary report.
8. Backup final state to zip.

---

## 5) Architecture (Frontend + Contracts + Storage)

- **Frontend runtime**: React 18 + Vite + Wouter + Zustand.
- **Engine**: pure TypeScript attendance engine (`client/src/engine/attendanceEngine.ts`).
- **Data contracts**: `shared/schema.ts` (Drizzle schema + Zod insert schemas), `shared/routes.ts` (typed API contracts).
- **Persistence**:
  - LocalStorage for most modules.
  - IndexedDB for punches when available.
- **Backend status today**: not present in this repository.

### ASCII Architecture Diagram

```text
                    ┌──────────────────────────────────┐
                    │            Browser UI            │
                    │   React + Vite + Wouter + RTL   │
                    └───────────────┬──────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────┐
                    │   Zustand Store (client state)   │
                    │ employees / punches / rules /    │
                    │ adjustments / leaves / records   │
                    └───────────────┬──────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌──────────────────────────────┐             ┌──────────────────────────────┐
│ attendanceEngine.ts          │             │ Excel Import/Export Layer    │
│ processAttendanceRecords()   │             │ templatesExporter +           │
│ rule scope + penalties +     │             │ attendanceExport + xlsx       │
│ overtime + Friday/holiday    │             └──────────────────────────────┘
└──────────────────────────────┘
              │
              ▼
┌──────────────────────────────┐
│ Persistence Layer            │
│ localStorage + IndexedDB     │
└──────────────────────────────┘

(Shared contracts for future backend)
┌──────────────────────────────┐
│ shared/schema.ts (Drizzle)   │
│ shared/routes.ts (API spec)  │
└──────────────────────────────┘
```

---

## 6) Folder Structure + Responsibilities

```text
.
├── client/
│   ├── src/
│   │   ├── pages/                # Screens (Dashboard, Attendance, Import, ...)
│   │   ├── engine/               # Attendance calculation engine + tests
│   │   ├── exporters/            # Excel report/template builders
│   │   ├── backup/               # Zip backup/restore utilities
│   │   ├── store/                # Zustand state + persistence adapter
│   │   ├── hooks/                # UI/data hooks wrapping store actions
│   │   └── components/           # UI shell + shadcn components
├── shared/
│   ├── schema.ts                # Drizzle table definitions + Zod schemas
│   ├── routes.ts                # Typed API contract definitions
│   └── rule-scope.ts            # Scope parser helpers (emp/dept/sector)
├── drizzle.config.ts            # Drizzle config (expects DATABASE_URL)
├── vite.config.ts               # Vite app config (root=client, outDir=dist/public)
├── vercel.json                  # SPA rewrite config for Vercel
└── package.json                 # scripts + dependencies
```

### Practical code ownership by area

- **Attendance logic**: `client/src/engine/*`
- **Report generation**: `client/src/exporters/*`
- **Import flows**: `client/src/pages/Import.tsx`, `BulkAdjustmentsImport.tsx`, `Rules.tsx`, `Leaves.tsx`
- **State & persistence**: `client/src/store/*`
- **Domain schema/contracts**: `shared/*`

---

## 7) Database

## Current runtime behavior (important)

The running app in this repo does **not** directly connect to PostgreSQL. It persists state in browser storage.

## Database contracts available in repo

`shared/schema.ts` defines PostgreSQL tables using Drizzle, including:

- `employees`
- `biometric_punches`
- `excel_templates`
- `special_rules`
- `adjustments`
- `attendance_records`
- `leaves`
- `official_holidays`

`drizzle.config.ts` points to:
- schema: `./shared/schema.ts`
- dialect: `postgresql`
- output migrations folder: `./migrations`
- env var: `DATABASE_URL`

### Migrations status

- The repository currently has **no `migrations/` folder** checked in.
- If you build a backend, generate migrations via Drizzle Kit before deployment.

---

## 8) API Endpoints (Contract Definitions)

> These are currently **typed contracts** in `shared/routes.ts` and not active HTTP handlers in this repo.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create employee |
| GET | `/api/employees/:id` | Get employee |
| PUT | `/api/employees/:id` | Update employee |
| GET | `/api/rules` | List rules |
| POST | `/api/rules` | Create rule |
| PUT | `/api/rules/:id` | Update rule |
| DELETE | `/api/rules/:id` | Delete rule |
| GET | `/api/adjustments` | List adjustments |
| POST | `/api/adjustments` | Create adjustment |
| POST | `/api/adjustments/import` | Bulk import adjustments |
| GET | `/api/leaves` | List leaves |
| POST | `/api/leaves` | Create leave |
| DELETE | `/api/leaves/:id` | Delete leave |
| POST | `/api/leaves/import` | Bulk import leaves |
| GET | `/api/attendance` | List attendance records |
| POST | `/api/attendance/process` | Process attendance for date range |
| POST | `/api/import/punches` | Import punch rows |
| POST | `/api/import/employees` | Import employee rows |

---

## 9) Excel Import / Export

## Import types

### A) Punches import (Import page)

Expected primary headers (recommended):

- `كود`
- `التاريخ_والوقت`

The importer also tries multiple aliases (`ID`, `Code`, `Employee ID`, `Date`, `Time`, `Punch Datetime`, etc.).

Accepted date formats include examples like:
- `dd/MM/yyyy HH:mm`
- `dd/MM/yyyy HH:mm:ss`
- `yyyy-MM-dd HH:mm:ss`
- ISO timestamps
- Excel serial dates

### B) Employees import

Minimum needed:
- employee code (`كود` / `Code` / `ID`)
- employee name (`الاسم` / `Name`)

Other fields (sector/department/... etc.) are optional but supported.

### C) Bulk effects import (المؤثرات)

Required header order:

1. `الكود`
2. `الاسم`
3. `التاريخ`
4. `من`
5. `إلى`
6. `النوع`
7. `الحالة`
8. `ملاحظة`

Validation behavior:
- Invalid rows are displayed in validation table (reason shown).
- Valid rows are persisted and auto-applied.
- Invalid rows do not block valid-row application.

## Export types

### Attendance report export (Attendance page)

Generates exactly 2 sheets:

1. **تفصيلي** (Detailed)
2. **ملخص** (Summary)

Additional robustness:
- pre-checks header presence before export
- shows user-friendly error toast if headers are incomplete
- try/catch around file generation to avoid silent failure

---

## 10) Local Development

## Prerequisites

- Node.js 20+
- npm 9+

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Default Vite dev server settings in this repo:
- host: `0.0.0.0`
- port: `5000`

## Build

```bash
npm run build
```

## Type check

```bash
npm run check
```

## Tests

```bash
npm run test
```

---

## 11) Deployment on Vercel

## What works today

Because this repository is currently Vite SPA only, the best deployment is:

- **Deploy frontend on Vercel as static build**.
- Keep data in browser persistence (current behavior), **or**
- Add a separate backend service (Render/Railway/Fly.io) and connect frontend to it.

## Why not direct Express-on-Vercel here?

There is no active Express server implementation in this repository now. `shared/routes.ts` is only contract metadata.

## Vercel settings (already aligned with repo)

- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist/public`
- Rewrites: already in `vercel.json`:
  - `/(.*) -> /index.html` (SPA routing)

## If you add a separate backend (recommended for PostgreSQL)

- Host backend on Render/Railway/Fly.io.
- Expose REST endpoints matching `shared/routes.ts` contract.
- Add CORS allow-list for your Vercel frontend domain.
- Configure frontend base URL env (you’ll need to introduce one, e.g. `VITE_API_BASE_URL`).

---

## 12) Database: Free External Options

> These apply when you introduce backend runtime (not needed for current browser-only mode).

## Option 1: Neon (Recommended)

Pros:
- Great free tier for Postgres
- Serverless-friendly
- Easy connection string

Cons:
- Free tier sleep/limits

Example `DATABASE_URL`:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
```

## Option 2: Supabase Postgres

Pros:
- Managed PostgreSQL + dashboard
- Good DX for table inspection

Cons:
- Additional platform concepts if you only need DB

Example:

```env
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

## Option 3: Render Postgres (free trial tiers vary)

Pros:
- Easy if backend is also on Render

Cons:
- Free offerings may change over time

Example:

```env
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<db>
```

---

## 13) Migration Checklist (Replit → Vercel) — Safe Path

Use this checklist to avoid breaking attendance logic (especially البصمة / time handling):

- [ ] Confirm current app behavior baseline with a known sample file.
- [ ] Export backup zip from current environment.
- [ ] Verify Vercel build locally with `npm run build`.
- [ ] Verify SPA routing on refresh (via `vercel.json` rewrite).
- [ ] Re-run a punch import sample including:
  - [ ] normal day
  - [ ] late arrival
  - [ ] missing checkout
  - [ ] Friday attendance
  - [ ] official holiday attendance
  - [ ] post-midnight punch
- [ ] Validate output sheets are both present (`تفصيلي`, `ملخص`).
- [ ] Compare key totals before/after migration:
  - [ ] total late penalties
  - [ ] total early leave penalties
  - [ ] missing stamp counts
  - [ ] absence weighted totals
  - [ ] comp-day totals (Friday + official)
- [ ] If introducing backend:
  - [ ] generate Drizzle migrations
  - [ ] apply schema to external Postgres
  - [ ] implement endpoints matching `shared/routes.ts`
  - [ ] configure CORS allow-list
  - [ ] keep date normalization behavior unchanged
- [ ] Do not change fingerprint parser or date/time normalization unless fully re-validated.

---

## 14) Troubleshooting

## `summaryHeaders is not defined` during export

- Ensure `handleExport` destructures `summaryHeaders` from `buildAttendanceExportRows`.
- Verify header validation guard exists before workbook creation.

## Build fails with JSX / duplicate symbol

- Check for accidental duplicate function declarations in pages (especially import pages).
- Ensure JSX tags are correctly nested and closed.

## Import says “no valid rows”

- Verify header names and date formats.
- For punches, ensure code + datetime are actually mapped.

## Wrong day/time around midnight

- This app applies local/UTC normalization and special handling for overnight punches.
- Re-check source timestamps and timezone assumptions before editing engine logic.

## Data disappeared after refresh

- Check browser storage quota and compatibility warnings.
- Use backup/restore page to export safety copy regularly.

---

## 15) Security Notes

- No authentication/authorization layer exists in current repo.
- Anyone with browser access can modify local data.
- If deploying for real usage:
  - Add login + role-based access.
  - Add audit log for imports/adjustments/rule changes.
  - Validate file uploads server-side if backend is added.
  - Encrypt transport with HTTPS only.

---

## 16) Backup Notes

- Use `/backup` page for module-level zip backups.
- Restore supports:
  - replace mode
  - merge mode
- Punches are serialized as ISO datetimes; attendance records are restored with date rehydration.
- Keep periodic backups before major imports or rule changes.

---

## 17) Roadmap (Suggested)

- Add real backend implementation (Express/Fastify/Next API) using existing shared contracts.
- Add PostgreSQL persistence as source of truth.
- Add user accounts and permissions.
- Add immutable audit trail and import job history.
- Add CI checks for attendance regression fixtures.

---

## 18) License / Contributing

- License in `package.json`: `MIT`.
- Internal contribution guidance:
  1. open small PRs by feature area (engine/import/export/store)
  2. include at least one regression scenario for attendance logic changes
  3. never modify parser/time logic without before/after fixture validation



## Smart Reprocess (إعادة معالجة ذكية)

- The Attendance screen now supports **smart reprocess** in addition to full reprocess.
- Smart mode reprocesses only the employee codes currently inside the active filtered result set, for the selected date range.
- Full reprocess remains available and unchanged.

## Effects time formats accepted on import

Effects importer accepts the following time value shapes for columns `من` and `الي`:
- Excel time fraction (e.g. `0.375` => `09:00`).
- Excel datetime serial numbers (time extracted from fractional part).
- JS `Date` cells returned by xlsx.
- Text values like `9`, `9:0`, `09:00`, `09:00:00`, `9 AM`, `9:30 PM`, `09:00 ص`, `12:30 م`.

All parsed values are normalized to `HH:mm` before validation/storage.

## Performance notes

- Large result sets use memoized derived selectors and virtualized row windows in heavy screens to reduce render cost.
- Effects parsing and matching uses normalized keys (`employeeCode + date`) to avoid repeated scans and reduce reprocess overhead.
- Export now performs pre-flight validation (headers/dates/employee code+name) to fail gracefully with Arabic error toasts instead of runtime crashes.
