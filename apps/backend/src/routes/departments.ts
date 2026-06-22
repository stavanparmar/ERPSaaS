import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorize } from "../middleware/auth";
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
} from "../utils/hr-validation";

const router = express.Router();
const prisma = new PrismaClient();

async function generateDepartmentCode(companyId: string, name: string): Promise<string> {
  const base =
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 6) || "DEPT";

  const existing = await prisma.department.findMany({
    where: {
      companyId,
      code: {
        startsWith: base,
      },
    },
    select: {
      code: true,
    },
  });

  const usedCodes = new Set(existing.map((dept) => dept.code));
  for (let i = 1; i <= 9999; i++) {
    const candidate = `${base}-${String(i).padStart(3, "0")}`;
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

/**
 * GET /api/v1/departments
 * Get all departments in the company
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

      const departments = await prisma.department.findMany({
        where: {
          companyId: req.user.companyId,
          deletedAt: null,
        },
        include: {
          _count: {
            select: { employees: true },
          },
        },
        orderBy: { name: "asc" },
      });

      res.status(200).json({
        statusCode: 200,
        data: departments.map((dept: any) => ({
          id: dept.id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          manager: null,
          employeeCount: dept._count.employees,
          createdAt: dept.createdAt,
        })),
        message: "Departments retrieved successfully",
      });
    } catch (error) {
      console.error("Get departments error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get departments",
      });
    }
  }
);

/**
 * GET /api/v1/departments/:id
 * Get a specific department
 */
router.get("/:id", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
      });
      return;
    }

    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: {
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            designation: true,
          },
        },
      },
    });

    if (!department || department.deletedAt) {
      res.status(404).json({
        statusCode: 404,
        error: "Not Found",
        message: "Department not found",
      });
      return;
    }

    if (department.companyId !== req.user.companyId && req.user.role !== "super_admin") {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "Department belongs to different company",
      });
      return;
    }

    res.status(200).json({
      statusCode: 200,
      data: {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        manager: null,
        employees: department.employees.map((emp: any) => ({
          id: emp.id,
          employeeId: emp.employeeId,
          name: `${emp.user.firstName} ${emp.user.lastName}`,
          email: emp.user.email,
          designation: emp.designation,
        })),
        createdAt: department.createdAt,
      },
      message: "Department retrieved successfully",
    });
  } catch (error) {
    console.error("Get department error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get department",
    });
  }
});

/**
 * POST /api/v1/departments
 * Create a new department
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

      const validationResult = CreateDepartmentSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { name, description } = validationResult.data;
      const code = await generateDepartmentCode(req.user.companyId, name);

      const department = await prisma.department.create({
        data: {
          code,
          name,
          description: description || null,
          companyId: req.user.companyId,
        },
      });

      res.status(201).json({
        statusCode: 201,
        data: {
          id: department.id,
          name: department.name,
          code: department.code,
          description: department.description,
          manager: null,
        },
        message: "Department created successfully",
      });
    } catch (error) {
      console.error("Create department error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create department",
      });
    }
  }
);

/**
 * PATCH /api/v1/departments/:id
 * Update a department
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

      const department = await prisma.department.findUnique({
        where: { id: req.params.id },
      });

      if (!department || department.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Department not found",
        });
        return;
      }

      if (department.companyId !== req.user.companyId && req.user.role !== "super_admin") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "Department belongs to different company",
        });
        return;
      }

      const validationResult = UpdateDepartmentSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { name, description } = validationResult.data;

      const updated = await prisma.department.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
        },
      });

      res.status(200).json({
        statusCode: 200,
        data: {
          id: updated.id,
          name: updated.name,
          code: updated.code,
          description: updated.description,
          manager: null,
        },
        message: "Department updated successfully",
      });
    } catch (error) {
      console.error("Update department error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to update department",
      });
    }
  }
);

/**
 * DELETE /api/v1/departments/:id
 * Soft delete a department
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

      const department = await prisma.department.findUnique({
        where: { id: req.params.id },
      });

      if (!department || department.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Department not found",
        });
        return;
      }

      if (department.companyId !== req.user.companyId && req.user.role !== "super_admin") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "Department belongs to different company",
        });
        return;
      }

      await prisma.department.update({
        where: { id: req.params.id },
        data: {
          deletedAt: new Date(),
        },
      });

      res.status(200).json({
        statusCode: 200,
        message: "Department deleted successfully",
      });
    } catch (error) {
      console.error("Delete department error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to delete department",
      });
    }
  }
);

export default router;
