# HR Attendance & Payroll System

## Overview

This is an HR Attendance and Payroll Management System built for Arabic-speaking organizations. The application provides comprehensive employee management, biometric attendance tracking, Excel-based data import/export, configurable attendance rules, and leave/adjustment management. The entire UI is designed with RTL (Right-to-Left) layout support for Arabic language users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, with custom hooks for data fetching
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with RTL support, custom Arabic fonts (Cairo, Tajawal)
- **Charts**: Recharts for dashboard analytics
- **Excel Processing**: xlsx library for client-side Excel file parsing

### Application Type
- **Frontend-only**: This is a client-side React application served by Vite dev server
- **No backend server**: All data processing happens in the browser
- **State Management**: Zustand for client-side state, with custom hooks
- **Build System**: Vite for development and production builds
- **Port**: Runs on port 5000 with host 0.0.0.0 for Replit compatibility

### Shared Code Pattern
- TypeScript interfaces and Zod schemas are defined in the `shared/` directory
- Both client and server import from shared modules for type safety
- API route definitions in shared/routes.ts ensure consistent typing across the stack

### Key Design Decisions
1. **RTL-First Design**: The entire application uses Arabic as the primary language with RTL layout baked into the CSS base
2. **Template-Based Excel Processing**: Flexible column mapping system allows different Excel formats for attendance data import
3. **Rule Priority System**: Special rules have priority levels and scopes (all employees, department-specific, individual) for flexible attendance policy configuration
4. **Typed API Layer**: Route definitions include input/output Zod schemas for end-to-end type safety

## External Dependencies

### Database
- PostgreSQL (required) - Connection via DATABASE_URL environment variable
- Drizzle Kit for migrations (`npm run db:push`)

### Third-Party Libraries
- **xlsx**: Excel file reading/writing for import/export functionality
- **date-fns**: Date manipulation for attendance calculations
- **connect-pg-simple**: PostgreSQL session storage (if sessions are implemented)

### UI Component Dependencies
- Radix UI primitives (dialogs, dropdowns, forms, etc.)
- Recharts for data visualization
- Lucide React for icons
- Embla Carousel for carousel components

### Development Tools
- Vite with React plugin for frontend development
- Replit-specific plugins for development experience (cartographer, dev-banner, error overlay)