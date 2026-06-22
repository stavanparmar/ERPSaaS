# ERP SaaS - Multi-Tenant Enterprise Resource Planning

A production-ready, multi-tenant SaaS ERP system built with modern technology stack.

## Phase 1 - Project Setup & Foundation

### ✅ What's Built

- **Monorepo structure** with Yarn workspaces
- **Backend (Express + TypeScript)**
  - Express.js server with comprehensive middleware
  - Helmet, CORS, rate limiting
  - Pino logging system
  - Ready for API development
  
- **Frontend (React + TypeScript + Tailwind)**
  - Vite-based React app
  - React Router for navigation
  - React Query for data fetching
  - Tailwind CSS for styling
  - Responsive UI components (Layout, Login, Dashboard)

- **Database (Prisma + PostgreSQL)**
  - Complete Prisma schema with 30+ models
  - Multi-tenant architecture with Company as boundary
  - RBAC foundation (super_admin, company_admin, employee)
  - Audit logging support
  - Soft deletes and timestamps on all entities

- **Shared Package**
  - Common TypeScript types and interfaces
  - API response models
  - Error handling utilities

---

## 📌 Project Status

**Phase 3 Complete ✅**  
Ready for **Phase 4: Inventory Module**

## 📁 Folder Structure

```
erp-saas-monorepo/
├── apps/
│   ├── backend/          # Node.js Express API
│   │   ├── src/
│   │   │   ├── index.ts  # Main app entry point
│   │   │   └── prisma/
│   │   │       └── seed.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   └── frontend/         # React dashboard
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Login.tsx
│       │   │   └── Dashboard.tsx
│       │   ├── components/
│       │   │   └── Layout.tsx
│       │   └── index.css
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── package.json
│       ├── tsconfig.json
│       ├── index.html
│       └── .env.example
│
├── packages/
│   └── shared/          # Shared types & utilities
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── package.json         # Root monorepo config
└── COPILOT_PROMPT.md    # Full ERP specification
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL database (local or Supabase)
- Git

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd erp-saas-monorepo
   npm install
   ```

2. **Setup environment variables:**

   Backend (apps/backend/.env):
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   # Edit with your Supabase credentials
   DATABASE_URL="postgresql://user:password@localhost:5432/erp_saas"
   JWT_SECRET="your-secret-key-min-32-chars"
   ```

   Frontend (apps/frontend/.env):
   ```bash
   cp apps/frontend/.env.example apps/frontend/.env
   # Edit with your API and Supabase URLs
   VITE_API_URL=http://localhost:3001/api/v1
   ```

3. **Setup database:**
   ```bash
   npm run db:migrate --workspace=apps/backend
   npm run db:seed --workspace=apps/backend
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend: http://localhost:3001
   - Frontend: http://localhost:3000

---

## 🏗️ Architecture Overview

### Multi-Tenant Design
- **Tenant Boundary:** Company model
- **Isolation:** All entities scoped by `companyId`
- **RBAC:** Three roles (super_admin, company_admin, employee)
- **Data Security:** Row-level security (RLS) on Supabase

### API Structure
- **Base URL:** `/api/v1`
- **Authentication:** JWT tokens (will be added in Phase 2)
- **Rate Limiting:** 100 requests per 15 minutes per IP
- **Response Format:** Standardized JSON with status codes

### Database Schema Highlights

**Core Entities:**
- Company (tenant boundary)
- User (with role association)
- Department, Employee
- Customer, Supplier
- Product, Category, InventoryTransaction

**Business Entities:**
- PurchaseOrder, SalesOrder
- Invoice, Payment
- Attendance, Leave, Payroll
- JournalEntry (accounting)
- AuditLog (compliance)

---

## 📋 Demo Credentials

After seeding the database:
- **Email:** admin@demo.com
- **Password:** demo@123
- **Company:** Demo Company

---

## 🔄 API Endpoints (Phase 1 - Placeholder)

| Method | Endpoint | Status |
|--------|----------|--------|
| GET | /api/v1 | ✅ Placeholder |
| GET | /health | ✅ Working |

API routes will be implemented in Phase 2 (Authentication & User Management).

---

## ✨ Key Features (Roadmap)

### Phase 1 (Complete)
- ✅ Project structure
- ✅ Database schema
- ✅ Base UI (Login, Dashboard, Layout)
- ✅ Middleware setup

### Phase 2 (Next)
- 🔲 User authentication (JWT)
- 🔲 Role-based access control middleware
- 🔲 User management APIs
- 🔲 User management UI

### Phases 3-10
- Employee management
- Inventory module
- Customer & Supplier management
- Purchase workflow
- Sales workflow
- Accounting module
- Reporting & analytics
- Production deployment

---

## 🧪 Testing

Run tests:
```bash
npm run test --workspaces
```

---

## 📝 Environment Variables

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `API_PORT` - Server port (default: 3001)
- `CORS_ORIGIN` - CORS allowed origin
- `LOG_LEVEL` - Pino log level

### Frontend (.env)
- `VITE_API_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Anon key for public operations

---

## 🔐 Security Notes

- Passwords hashed with bcryptjs (bcrypt)
- Rate limiting enabled on API
- CORS configured for specific origins
- Helmet.js for HTTP security headers
- SQL injection prevention via Prisma parameterization
- XSS protection via React's built-in escaping

---

## 📚 Tech Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- React Query

**Backend:**
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Pino (logging)

**DevOps (Ready for Phase 10):**
- Vercel (Frontend)
- Render/Railway (Backend)
- Supabase (Database + Auth)

---

## 🤝 Next Steps

1. Validate current modules end-to-end (Auth, Users, HR, Attendance)
2. Start **Phase 4: Inventory Module** (categories, suppliers, products, stock transactions)
3. Add inventory test coverage for API and critical UI flows
4. Update deployment docs and environment setup after each completed phase

---
