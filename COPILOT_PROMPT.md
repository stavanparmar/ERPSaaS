# ERP SaaS Build Prompt for GitHub Copilot Agent

## Role
You are a principal software architect and senior full-stack engineer.

## Goal
Build a production-ready multi-tenant SaaS ERP web app for SMBs, using a phased implementation with working code, tests, and deployment docs.

## Critical Execution Rules
1. **Build in phases and stop after each phase.**
2. **At the end of each phase, output:**
   - What was built
   - Files created or changed
   - How to run locally
   - API endpoints added
   - Test status
   - Known limitations
   - Next phase plan
3. Do not skip database migrations, validation, or authorization.
4. Always include tenant isolation and role-based access control in every module.
5. Prefer simple, maintainable architecture over premature complexity.
6. Use secure defaults for all auth and API behavior.

---

## Technology Stack

### Frontend
- React
- TypeScript
- Tailwind CSS
- React Router
- React Query
- Responsive UI

### Backend
- Node.js
- Express
- TypeScript
- Zod validation
- Winston or Pino logging
- Rate limiting

### Database & Auth
- Supabase PostgreSQL
- Supabase Auth
- Prisma ORM
- Row Level Security on tenant-scoped tables

### Hosting
- Frontend on Vercel
- Backend on Render or Railway
- Database on Supabase Free Tier

---

## Architecture Requirements
- **Multi-tenant SaaS** with Company as tenant boundary
- **Tenant-aware data model** (companyId on business entities)
- **Strict RBAC** with permission matrix
- **Audit logging** for sensitive actions
- **Soft deletes and timestamps** on core entities
- **Pagination, filtering, sorting, search** in list APIs
- **Centralized error handling** and request validation
- **API versioning** under /api/v1

---

## User Roles
- **Super Admin** – System administration, subscription management
- **Company Admin** – Company settings, department management, team management
- **Employee** – Access assigned modules, create documents, view reports

---

## Authentication & Security
- Registration, login, forgot password, email verification
- JWT or Supabase session validation at API layer
- Bcrypt password hashing where applicable
- RBAC middleware
- Helmet, CORS policy, rate limiting
- SQL injection prevention through Prisma parameterization
- XSS and CSRF protections
- Audit logs for login, role changes, financial actions

---

## ERP Modules to Build
1. Dashboard
2. User management
3. Employee management
4. Inventory
5. Supplier management
6. Customer management (CRM)
7. Purchase management
8. Sales management
9. Accounting
10. Attendance
11. Payroll
12. Reporting and exports (PDF/Excel/CSV)

---

## Data Model (Prisma Schema)
Generate full schema for:
- Company
- User
- Role
- Permission
- Department
- Employee
- Customer
- Supplier
- Product
- Category
- InventoryTransaction
- PurchaseOrder
- PurchaseItem
- SalesOrder
- SalesItem
- Invoice
- Payment
- Attendance
- Leave
- Payroll
- JournalEntry
- AuditLog

Include:
- Primary and foreign keys
- Indexes
- Proper relationships
- Soft delete columns
- createdAt and updatedAt timestamps
- companyId tenant scoping where required

---

## Phase Plan

### Phase 1
- Monorepo/project setup
- Folder architecture
- Base backend and frontend scaffolding
- Prisma schema and initial migrations
- Supabase setup notes
- Tenant and RBAC foundations

### Phase 2
- Authentication and authorization
- User and role management APIs and UI
- Invite user flow (optional if time permits)

### Phase 3
- Employee module (API + UI + validation + tests)

### Phase 4
- Inventory module (API + UI + stock transactions + tests)

### Phase 5
- Customer and supplier modules

### Phase 6
- Purchase workflow (requisition to invoice)

### Phase 7
- Sales workflow (lead to payment)

### Phase 8
- Accounting core (COA, journal, ledger, trial balance, P&L, balance sheet)

### Phase 9
- Reporting and analytics dashboards with export

### Phase 10
- Production readiness and deployment
- CI/CD
- Environment variables and secrets checklist
- Monitoring and logging setup
- Backup and recovery notes

---

## Per-Phase Output Contract
For each phase, provide:
1. Folder structure
2. Database changes
3. Backend code
4. API routes with sample request/response
5. Frontend pages and components
6. Validation schemas
7. Tests (unit/integration where relevant)
8. Run instructions

Then stop and wait for confirmation before starting the next phase.

---

## Success Criteria
- App runs locally end-to-end
- Tenant data isolation enforced
- RBAC enforced at API and UI level
- Core ERP flows work
- Basic tests pass
- Deployment documentation is complete

---

## Start
**Build Phase 1 only** using this prompt.

---

## How to Use This Prompt Effectively
1. Paste this entire prompt into GitHub Copilot Chat.
2. Ask: "Build Phase 1 only."
3. After code is generated, run it locally, fix issues, commit.
4. Then ask: "Continue with Phase 2 using the existing codebase. Do not regenerate Phase 1."
5. Repeat phase by phase.
