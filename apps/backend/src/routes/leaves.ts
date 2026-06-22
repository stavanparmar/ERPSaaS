import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorize } from "../middleware/auth";
import { CreateLeaveSchema, UpdateLeaveSchema } from "../utils/hr-validation";

const router = express.Router();
const prisma = new PrismaClient();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function calculateLeaveDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

router.get("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const { employeeId, status, type } = req.query;

    const leaves = await prisma.leave.findMany({
      where: {
        companyId: req.user.companyId,
        deletedAt: null,
        ...(employeeId ? { employeeId: String(employeeId) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(type ? { type: String(type) } : {}),
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
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      statusCode: 200,
      data: leaves.map((leave: any) => ({
        id: leave.id,
        employeeId: leave.employeeId,
        employee: {
          id: leave.employee.id,
          employeeId: leave.employee.employeeId,
          name: `${leave.employee.user.firstName} ${leave.employee.user.lastName}`,
          email: leave.employee.user.email,
        },
        type: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days,
        status: leave.status,
        reason: leave.reason,
        createdAt: leave.createdAt,
      })),
      message: "Leave requests retrieved successfully",
    });
  } catch (error) {
    console.error("Get leaves error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get leave requests",
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
      where: { userId: req.user.userId, companyId: req.user.companyId, deletedAt: null },
    });

    if (!employee) {
      res.status(404).json({
        statusCode: 404,
        error: "Not Found",
        message: "Employee profile not found for current user",
      });
      return;
    }

    const leaves = await prisma.leave.findMany({
      where: {
        companyId: req.user.companyId,
        employeeId: employee.id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      statusCode: 200,
      data: leaves,
      message: "My leave requests retrieved successfully",
    });
  } catch (error) {
    console.error("Get my leaves error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get my leave requests",
    });
  }
});

router.get("/balance/:employeeId", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { id: req.params.employeeId },
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

    if (req.user.role === "employee" && employee.userId !== req.user.userId) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "You can only view your own leave balance",
      });
      return;
    }

    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const approvedLeaves = await prisma.leave.findMany({
      where: {
        companyId: req.user.companyId,
        employeeId: employee.id,
        status: "approved",
        deletedAt: null,
        startDate: { gte: startOfYear },
        endDate: { lte: endOfYear },
      },
      select: { type: true, days: true },
    });

    const entitlement = {
      casual: 12,
      sick: 12,
      earned: 18,
      maternity: 90,
      paternity: 15,
      unpaid: 999,
      other: 0,
    };

    const used = {
      casual: 0,
      sick: 0,
      earned: 0,
      maternity: 0,
      paternity: 0,
      unpaid: 0,
      other: 0,
    };

    approvedLeaves.forEach((leave: any) => {
      const key = leave.type as keyof typeof used;
      if (key in used) {
        used[key] += leave.days;
      }
    });

    res.status(200).json({
      statusCode: 200,
      data: {
        employeeId: employee.id,
        year,
        entitlement,
        used,
        balance: {
          casual: entitlement.casual - used.casual,
          sick: entitlement.sick - used.sick,
          earned: entitlement.earned - used.earned,
          maternity: entitlement.maternity - used.maternity,
          paternity: entitlement.paternity - used.paternity,
          unpaid: "unlimited",
          other: entitlement.other - used.other,
        },
      },
      message: "Leave balance retrieved successfully",
    });
  } catch (error) {
    console.error("Get leave balance error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get leave balance",
    });
  }
});

router.post("/", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const validationResult = CreateLeaveSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        statusCode: 400,
        error: "Validation Error",
        message: validationResult.error.errors[0].message,
      });
      return;
    }

    const { employeeId, leaveType, startDate, endDate, reason, status } = validationResult.data;

    if (req.user.role !== "employee" && !employeeId) {
      res.status(400).json({
        statusCode: 400,
        error: "Validation Error",
        message: "Employee ID is required",
      });
      return;
    }

    let resolvedEmployeeId = employeeId || "";
    if (req.user.role === "employee") {
      const myEmployee = await prisma.employee.findFirst({
        where: {
          userId: req.user.userId,
          companyId: req.user.companyId,
          deletedAt: null,
        },
      });

      if (!myEmployee) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Employee profile not found for current user",
        });
        return;
      }

      resolvedEmployeeId = myEmployee.id;
    }

    const employee = await prisma.employee.findUnique({
      where: { id: resolvedEmployeeId },
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

    if (req.user.role === "employee" && employee.userId !== req.user.userId) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "You can only submit leave requests for yourself",
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = calculateLeaveDays(start, end);

    if (days <= 0) {
      res.status(400).json({
        statusCode: 400,
        error: "Validation Error",
        message: "End date must be on or after start date",
      });
      return;
    }

    const leave = await prisma.leave.create({
      data: {
        companyId: req.user.companyId,
        employeeId: resolvedEmployeeId,
        type: leaveType,
        startDate: start,
        endDate: end,
        days,
        reason,
        status: status || "pending",
      },
    });

    res.status(201).json({
      statusCode: 201,
      data: leave,
      message: "Leave request created successfully",
    });
  } catch (error) {
    console.error("Create leave error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to create leave request",
    });
  }
});

router.patch(
  "/:id/status",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validationResult = UpdateLeaveSchema.safeParse(req.body);
      if (!validationResult.success || !validationResult.data.status) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: "A valid status is required",
        });
        return;
      }

      const leave = await prisma.leave.findUnique({ where: { id: req.params.id } });

      if (!leave || leave.companyId !== req.user.companyId || leave.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Leave request not found",
        });
        return;
      }

      const updated = await prisma.leave.update({
        where: { id: req.params.id },
        data: {
          status: validationResult.data.status,
          ...(validationResult.data.reason ? { reason: validationResult.data.reason } : {}),
        },
      });

      res.status(200).json({
        statusCode: 200,
        data: updated,
        message: "Leave request updated successfully",
      });
    } catch (error) {
      console.error("Update leave status error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to update leave status",
      });
    }
  }
);

router.patch("/:id/cancel", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const leave = await prisma.leave.findUnique({
      where: { id: req.params.id },
      include: { employee: true },
    });

    if (!leave || leave.companyId !== req.user.companyId || leave.deletedAt) {
      res.status(404).json({
        statusCode: 404,
        error: "Not Found",
        message: "Leave request not found",
      });
      return;
    }

    const canCancel =
      req.user.role !== "employee" || leave.employee.userId === req.user.userId;

    if (!canCancel) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "You can only cancel your own leave request",
      });
      return;
    }

    if (leave.status === "approved") {
      res.status(400).json({
        statusCode: 400,
        error: "Bad Request",
        message: "Approved leave requests cannot be cancelled",
      });
      return;
    }

    const updated = await prisma.leave.update({
      where: { id: req.params.id },
      data: { status: "cancelled" },
    });

    res.status(200).json({
      statusCode: 200,
      data: updated,
      message: "Leave request cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel leave error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to cancel leave request",
    });
  }
});

export default router;
