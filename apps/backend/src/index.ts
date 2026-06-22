import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import departmentRoutes from "./routes/departments";
import employeeRoutes from "./routes/employees";
import attendanceRoutes from "./routes/attendance";
import leaveRoutes from "./routes/leaves";
import payrollRoutes from "./routes/payrolls";
import salesRoutes from "./routes/sales";
import inventoryRoutes from "./routes/inventory";
import accountingRoutes from "./routes/accounting";

dotenv.config();

const app: Express = express();
const port = process.env.API_PORT || 3001;

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

// Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(pinoHttp({ logger }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again in a few minutes.",
  },
});
app.use("/api/", limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware for tenant context
app.use((req: Request, res: Response, next: NextFunction) => {
  const companyId = req.headers["x-company-id"] as string;
  if (companyId) {
    (req as any).companyId = companyId;
  }
  next();
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API v1 routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/leaves", leaveRoutes);
app.use("/api/v1/payrolls", payrollRoutes);
app.use("/api/v1/sales", salesRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/accounting", accountingRoutes);

// API root endpoint
app.get("/api/v1", (req: Request, res: Response) => {
  res.json({
    message: "ERP SaaS API v1",
    endpoints: {
      auth: [
        "POST /api/v1/auth/register - Register new company",
        "POST /api/v1/auth/login - Login user",
        "POST /api/v1/auth/refresh - Refresh access token",
        "POST /api/v1/auth/logout - Logout user",
        "GET /api/v1/auth/me - Get current user",
      ],
      users: [
        "GET /api/v1/users - List all users",
        "GET /api/v1/users/:id - Get user by id",
        "POST /api/v1/users - Create new user",
        "PATCH /api/v1/users/:id - Update user",
        "DELETE /api/v1/users/:id - Delete user",
      ],
      departments: [
        "GET /api/v1/departments - List all departments",
        "GET /api/v1/departments/:id - Get department details",
        "POST /api/v1/departments - Create new department",
        "PATCH /api/v1/departments/:id - Update department",
        "DELETE /api/v1/departments/:id - Delete department",
      ],
      employees: [
        "GET /api/v1/employees - List all employees",
        "GET /api/v1/employees/:id - Get employee details",
        "POST /api/v1/employees - Create new employee",
        "PATCH /api/v1/employees/:id - Update employee",
        "DELETE /api/v1/employees/:id - Delete employee",
      ],
      attendance: [
        "GET /api/v1/attendance - List attendance records",
        "GET /api/v1/attendance/employee/:employeeId - Get employee attendance",
        "POST /api/v1/attendance - Create attendance record",
        "PATCH /api/v1/attendance/:id - Update attendance",
        "DELETE /api/v1/attendance/:id - Delete attendance",
      ],
      leaves: [
        "GET /api/v1/leaves - List leave requests",
        "GET /api/v1/leaves/my - Get current user leave requests",
        "GET /api/v1/leaves/balance/:employeeId - Get employee leave balance",
        "POST /api/v1/leaves - Submit leave request",
        "PATCH /api/v1/leaves/:id/status - Approve or reject leave request",
        "PATCH /api/v1/leaves/:id/cancel - Cancel leave request",
      ],
      payrolls: [
        "GET /api/v1/payrolls - List payroll records",
        "GET /api/v1/payrolls/my - Get current user payroll records",
        "POST /api/v1/payrolls - Create payroll record",
        "PATCH /api/v1/payrolls/:id - Update payroll record",
      ],
      sales: [
        "GET /api/v1/sales/customers - List customers",
        "POST /api/v1/sales/customers - Create customer",
        "GET /api/v1/sales/products - List products for sales",
        "GET /api/v1/sales/orders - List sales orders",
        "POST /api/v1/sales/orders - Create sales order",
        "GET /api/v1/sales/invoices - List invoices",
        "POST /api/v1/sales/invoices - Create invoice",
        "POST /api/v1/sales/payments - Record invoice payment",
      ],
      inventory: [
        "GET /api/v1/inventory/categories - List product categories",
        "POST /api/v1/inventory/categories - Create product category",
        "GET /api/v1/inventory/suppliers - List suppliers",
        "POST /api/v1/inventory/suppliers - Create supplier",
        "GET /api/v1/inventory/products - List products",
        "POST /api/v1/inventory/products - Create product",
        "POST /api/v1/inventory/transactions/adjust - Adjust stock",
        "GET /api/v1/inventory/transactions - List inventory transactions",
        "GET /api/v1/inventory/purchase-orders - List purchase orders",
        "POST /api/v1/inventory/purchase-orders - Create purchase order",
        "PATCH /api/v1/inventory/purchase-orders/:id/receive - Receive purchase order items",
        "POST /api/v1/inventory/transfers - Record stock transfer",
      ],
      accounting: [
        "GET /api/v1/accounting/journal-entries - List journal entries",
        "POST /api/v1/accounting/journal-entries - Create journal entry",
        "PATCH /api/v1/accounting/journal-entries/:id/status - Update journal status",
        "GET /api/v1/accounting/ledger - View general ledger summary",
        "GET /api/v1/accounting/trial-balance - Generate trial balance",
        "GET /api/v1/accounting/financial-reports - Generate financial summary report",
      ],
    },
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Start server
app.listen(port, () => {
  logger.info(`🚀 Server running on http://localhost:${port}`);
});

export default app;
