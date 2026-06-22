import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorize } from "../middleware/auth";
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
} from "../utils/hr-validation";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/employees
 * Get all employees in the company
 */
router.get(
  "/",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const { departmentId, status } = req.query;

      const employees = await prisma.employee.findMany({
        where: {
          user: {
            companyId: req.user.companyId,
          },
          deletedAt: null,
          ...(departmentId && { departmentId: departmentId as string }),
          ...(status && { status: status as string }),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.status(200).json({
        statusCode: 200,
        data: employees.map((emp: any) => ({
          id: emp.id,
          employeeId: emp.employeeId,
          user: emp.user,
          designation: emp.designation,
          department: emp.department,
          salary: emp.salary,
          joiningDate: emp.joiningDate,
          status: emp.status,
          createdAt: emp.createdAt,
        })),
        message: "Employees retrieved successfully",
      });
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get employees",
      });
    }
  }
);

/**
 * GET /api/v1/employees/:id
 * Get a specific employee
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const employee = await prisma.employee.findUnique({
        where: { id: req.params.id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          attendance: {
            where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            orderBy: { date: "desc" },
            take: 30,
          },
        },
      });

      if (!employee || employee.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Employee not found",
        });
        return;
      }

      if (employee.user.id !== req.user.userId && req.user.role === "employee") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "You can only view your own profile",
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: {
          id: employee.id,
          employeeId: employee.employeeId,
          user: employee.user,
          designation: employee.designation,
          department: employee.department,
          salary: employee.salary,
          joiningDate: employee.joiningDate,
          status: employee.status,
          recentAttendance: employee.attendance,
          createdAt: employee.createdAt,
        },
        message: "Employee retrieved successfully",
      });
    } catch (error) {
      console.error("Get employee error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get employee",
      });
    }
  }
);

/**
 * POST /api/v1/employees
 * Create a new employee
 */
router.post(
  "/",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const validationResult = CreateEmployeeSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { userId, employeeId, departmentId, designation, salary, joiningDate, phoneNumber, address, manager } =
        validationResult.data;

      // Verify user exists and belongs to company
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.companyId !== req.user.companyId) {
        res.status(400).json({
          statusCode: 400,
          error: "Bad Request",
          message: "User not found or belongs to different company",
        });
        return;
      }

      // Verify department exists
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });

      if (!department || department.deletedAt) {
        res.status(400).json({
          statusCode: 400,
          error: "Bad Request",
          message: "Department not found",
        });
        return;
      }

      // Check if employee ID is unique
      const existing = await prisma.employee.findFirst({
        where: {
          employeeId,
          user: { companyId: req.user.companyId },
        },
      });

      if (existing) {
        res.status(409).json({
          statusCode: 409,
          error: "Conflict",
          message: "Employee ID already exists",
        });
        return;
      }

      const employee = await prisma.employee.create({
        data: {
          userId,
          employeeId,
          departmentId,
          designation,
          salary: salary || null,
          joiningDate: new Date(joiningDate),
          phone: phoneNumber || null,
          address: address || null,
          manager: manager || null,
          status: "active",
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(201).json({
        statusCode: 201,
        data: {
          id: employee.id,
          employeeId: employee.employeeId,
          user: employee.user,
          designation: employee.designation,
          department: employee.department,
          salary: employee.salary,
          joiningDate: employee.joiningDate,
          status: employee.status,
        },
        message: "Employee created successfully",
      });
    } catch (error) {
      console.error("Create employee error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create employee",
      });
    }
  }
);

/**
 * PATCH /api/v1/employees/:id
 * Update an employee
 */
router.patch(
  "/:id",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const employee = await prisma.employee.findUnique({
        where: { id: req.params.id },
      });

      if (!employee || employee.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Employee not found",
        });
        return;
      }

      const validationResult = UpdateEmployeeSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { employeeId, departmentId, designation, salary, phoneNumber, address, manager, status } =
        validationResult.data;

      // Verify department if being updated
      if (departmentId) {
        const department = await prisma.department.findUnique({
          where: { id: departmentId },
        });

        if (!department || department.deletedAt) {
          res.status(400).json({
            statusCode: 400,
            error: "Bad Request",
            message: "Department not found",
          });
          return;
        }
      }

      // Check employee ID uniqueness if changing
      if (employeeId && employeeId !== employee.employeeId) {
        const existing = await prisma.employee.findFirst({
          where: {
            employeeId,
            id: { not: employee.id },
          },
        });

        if (existing) {
          res.status(409).json({
            statusCode: 409,
            error: "Conflict",
            message: "Employee ID already in use",
          });
          return;
        }
      }

      const updated = await prisma.employee.update({
        where: { id: req.params.id },
        data: {
          ...(employeeId && { employeeId }),
          ...(departmentId && { departmentId }),
          ...(designation && { designation }),
          ...(salary !== undefined && { salary }),
          ...(phoneNumber !== undefined && { phone: phoneNumber }),
          ...(address !== undefined && { address }),
          ...(manager !== undefined && { manager }),
          ...(status && { status }),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(200).json({
        statusCode: 200,
        data: {
          id: updated.id,
          employeeId: updated.employeeId,
          user: updated.user,
          designation: updated.designation,
          department: updated.department,
          salary: updated.salary,
          joiningDate: updated.joiningDate,
          status: updated.status,
        },
        message: "Employee updated successfully",
      });
    } catch (error) {
      console.error("Update employee error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to update employee",
      });
    }
  }
);

/**
 * DELETE /api/v1/employees/:id
 * Soft delete an employee
 */
router.delete(
  "/:id",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const employee = await prisma.employee.findUnique({
        where: { id: req.params.id },
      });

      if (!employee || employee.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Employee not found",
        });
        return;
      }

      await prisma.employee.update({
        where: { id: req.params.id },
        data: {
          deletedAt: new Date(),
          status: "inactive",
        },
      });

      res.status(200).json({
        statusCode: 200,
        message: "Employee deleted successfully",
      });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to delete employee",
      });
    }
  }
);

export default router;
