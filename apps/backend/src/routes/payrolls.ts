import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorize } from "../middleware/auth";
import { CreatePayrollSchema, UpdatePayrollSchema } from "../utils/hr-validation";

const router = express.Router();
const prisma = new PrismaClient();

function getMonthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function computeNetSalary(baseSalary: number, bonuses: number, deductions: number, taxes: number): number {
  return baseSalary + bonuses - deductions - taxes;
}

router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const { employeeId, status, month } = req.query;

    const payrolls = await prisma.payroll.findMany({
      where: {
        companyId: req.user.companyId,
        deletedAt: null,
        ...(employeeId ? { employeeId: String(employeeId) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(month ? { month: getMonthStart(String(month)) } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      statusCode: 200,
      data: payrolls.map((payroll: any) => ({
        id: payroll.id,
        employeeId: payroll.employeeId,
        employee: {
          id: payroll.employee.id,
          employeeId: payroll.employee.employeeId,
          name: `${payroll.employee.user.firstName} ${payroll.employee.user.lastName}`,
          email: payroll.employee.user.email,
        },
        month: payroll.month,
        baseSalary: payroll.baseSalary,
        bonuses: payroll.bonuses,
        deductions: payroll.deductions,
        taxes: payroll.taxes,
        netSalary: payroll.netSalary,
        status: payroll.status,
        notes: payroll.notes,
      })),
      message: "Payroll records retrieved successfully",
    });
  } catch (error) {
    console.error("Get payrolls error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get payroll records",
    });
  }
});

router.get("/my", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const employee = await prisma.employee.findFirst({
      where: {
        userId: req.user.userId,
        companyId: req.user.companyId,
        deletedAt: null,
      },
    });

    if (!employee) {
      res.status(404).json({
        statusCode: 404,
        error: "Not Found",
        message: "Employee profile not found",
      });
      return;
    }

    const payrolls = await prisma.payroll.findMany({
      where: {
        companyId: req.user.companyId,
        employeeId: employee.id,
        deletedAt: null,
      },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      statusCode: 200,
      data: payrolls,
      message: "My payroll records retrieved successfully",
    });
  } catch (error) {
    console.error("Get my payrolls error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get my payroll records",
    });
  }
});

router.post(
  "/",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validationResult = CreatePayrollSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { employeeId, month, baseSalary, bonuses, deductions, taxes, notes } = validationResult.data;

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: true },
      });

      if (!employee || employee.companyId !== req.user.companyId || employee.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Employee not found",
        });
        return;
      }

      const resolvedBaseSalary = baseSalary ?? employee.salary ?? 0;
      if (resolvedBaseSalary <= 0) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: "Base salary must be provided or configured for employee",
        });
        return;
      }

      const resolvedBonuses = bonuses ?? 0;
      const resolvedDeductions = deductions ?? 0;
      const resolvedTaxes = taxes ?? 0;
      const netSalary = computeNetSalary(
        resolvedBaseSalary,
        resolvedBonuses,
        resolvedDeductions,
        resolvedTaxes
      );

      const monthDate = getMonthStart(month);

      const existing = await prisma.payroll.findFirst({
        where: {
          companyId: req.user.companyId,
          employeeId,
          month: monthDate,
          deletedAt: null,
        },
      });

      if (existing) {
        res.status(409).json({
          statusCode: 409,
          error: "Conflict",
          message: "Payroll already exists for this employee and month",
        });
        return;
      }

      const payroll = await prisma.payroll.create({
        data: {
          companyId: req.user.companyId,
          employeeId,
          month: monthDate,
          baseSalary: resolvedBaseSalary,
          bonuses: resolvedBonuses,
          deductions: resolvedDeductions,
          taxes: resolvedTaxes,
          netSalary,
          status: "draft",
          notes: notes ?? null,
        },
      });

      res.status(201).json({
        statusCode: 201,
        data: payroll,
        message: "Payroll created successfully",
      });
    } catch (error) {
      console.error("Create payroll error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create payroll",
      });
    }
  }
);

router.patch(
  "/:id",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });
      if (!payroll || payroll.companyId !== req.user.companyId || payroll.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Payroll record not found",
        });
        return;
      }

      const validationResult = UpdatePayrollSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { baseSalary, bonuses, deductions, taxes, notes, status } = validationResult.data;

      const nextBaseSalary = baseSalary ?? payroll.baseSalary;
      const nextBonuses = bonuses ?? payroll.bonuses;
      const nextDeductions = deductions ?? payroll.deductions;
      const nextTaxes = taxes ?? payroll.taxes;
      const nextNetSalary = computeNetSalary(nextBaseSalary, nextBonuses, nextDeductions, nextTaxes);

      const updated = await prisma.payroll.update({
        where: { id: req.params.id },
        data: {
          ...(baseSalary !== undefined ? { baseSalary } : {}),
          ...(bonuses !== undefined ? { bonuses } : {}),
          ...(deductions !== undefined ? { deductions } : {}),
          ...(taxes !== undefined ? { taxes } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(status !== undefined ? { status } : {}),
          netSalary: nextNetSalary,
        },
      });

      res.status(200).json({
        statusCode: 200,
        data: updated,
        message: "Payroll updated successfully",
      });
    } catch (error) {
      console.error("Update payroll error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to update payroll",
      });
    }
  }
);

export default router;
