import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorize } from "../middleware/auth";
import {
  CreateAttendanceSchema,
  UpdateAttendanceSchema,
} from "../utils/hr-validation";

const router = express.Router();
const prisma = new PrismaClient();

function combineDateAndTime(dateValue: string, timeValue?: string): Date | null {
  if (!timeValue) {
    return null;
  }

  const [hour, minute] = timeValue.split(":").map(Number);
  const result = new Date(dateValue);
  result.setHours(hour || 0, minute || 0, 0, 0);
  return result;
}

/**
 * GET /api/v1/attendance
 * Get attendance records
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

      const { employeeId, startDate, endDate, status } = req.query;

      // Build where clause
      const where: any = {
        employee: {
          user: {
            companyId: req.user.companyId,
          },
        },
      };

      if (employeeId) {
        where.employeeId = employeeId;
      }

      where.deletedAt = null;

      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          where.date.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.date.lte = new Date(endDate as string);
        }
      }

      if (status) {
        where.status = status;
      }

      const attendance = await prisma.attendance.findMany({
        where,
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
        orderBy: { date: "desc" },
      });

      res.status(200).json({
        statusCode: 200,
        data: attendance.map((record: any) => ({
          id: record.id,
          employeeId: record.employee.id,
          employee: `${record.employee.user.firstName} ${record.employee.user.lastName}`,
          date: record.date,
          checkInTime: record.checkIn,
          checkOutTime: record.checkOut,
          status: record.status,
          notes: record.notes,
        })),
        message: "Attendance records retrieved successfully",
      });
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get attendance",
      });
    }
  }
);

/**
 * GET /api/v1/attendance/employee/:employeeId
 * Get attendance for a specific employee
 */
router.get(
  "/employee/:employeeId",
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

      const { employeeId } = req.params;
      const { year, month } = req.query;

      // Verify employee exists and belongs to company
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: true },
      });

      if (!employee || employee.user.companyId !== req.user.companyId) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Employee not found",
        });
        return;
      }

      // If employee, can only view own records
      if (employee.user.id !== req.user.userId && req.user.role === "employee") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "You can only view your own attendance",
        });
        return;
      }

      // Build date filter
      let dateFilter: any = {};
      if (year && month) {
        const startDate = new Date(Number(year), Number(month) - 1, 1);
        const endDate = new Date(Number(year), Number(month), 0);
        dateFilter = {
          gte: startDate,
          lte: endDate,
        };
      }

      const attendance = await prisma.attendance.findMany({
        where: {
          companyId: req.user.companyId,
          employeeId,
          deletedAt: null,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        orderBy: { date: "desc" },
      });

      // Calculate stats
      const present = attendance.filter((a: any) => a.status === "present").length;
      const absent = attendance.filter((a: any) => a.status === "absent").length;
      const halfDay = attendance.filter((a: any) => a.status === "half_day").length;
      const leave = attendance.filter((a: any) => a.status === "leave").length;

      res.status(200).json({
        statusCode: 200,
        data: {
          employee: {
            id: employee.id,
            employeeId: employee.employeeId,
            name: `${employee.user.firstName} ${employee.user.lastName}`,
          },
          stats: {
            present,
            absent,
            halfDay,
            leave,
            total: attendance.length,
          },
          records: attendance.map((record: any) => ({
            id: record.id,
            date: record.date,
            checkInTime: record.checkIn,
            checkOutTime: record.checkOut,
            status: record.status,
            notes: record.notes,
          })),
        },
        message: "Employee attendance retrieved successfully",
      });
    } catch (error) {
      console.error("Get employee attendance error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get employee attendance",
      });
    }
  }
);

/**
 * POST /api/v1/attendance
 * Create attendance record
 */
router.post(
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

      const validationResult = CreateAttendanceSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { employeeId, date, checkInTime, checkOutTime, status, notes } =
        validationResult.data;

      // Verify employee exists and belongs to company
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: true },
      });

      if (!employee || employee.user.companyId !== req.user.companyId) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Employee not found",
        });
        return;
      }

      // Check if record already exists for this date
      const existing = await prisma.attendance.findFirst({
        where: {
          companyId: req.user.companyId,
          employeeId,
          date: new Date(date),
          deletedAt: null,
        },
      });

      if (existing) {
        res.status(409).json({
          statusCode: 409,
          error: "Conflict",
          message: "Attendance record already exists for this date",
        });
        return;
      }

      const attendance = await prisma.attendance.create({
        data: {
          companyId: req.user.companyId,
          employeeId,
          date: new Date(date),
          checkIn: combineDateAndTime(date, checkInTime),
          checkOut: combineDateAndTime(date, checkOutTime),
          status,
          notes: notes || null,
        },
      });

      res.status(201).json({
        statusCode: 201,
        data: {
          id: attendance.id,
          employeeId: attendance.employeeId,
          date: attendance.date,
          checkInTime: attendance.checkIn,
          checkOutTime: attendance.checkOut,
          status: attendance.status,
          notes: attendance.notes,
        },
        message: "Attendance record created successfully",
      });
    } catch (error) {
      console.error("Create attendance error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create attendance",
      });
    }
  }
);

/**
 * PATCH /api/v1/attendance/:id
 * Update attendance record
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

      const record = await prisma.attendance.findUnique({
        where: { id: req.params.id },
      });

      if (!record || record.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Attendance record not found",
        });
        return;
      }

      if (record.companyId !== req.user.companyId && req.user.role !== "super_admin") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "Attendance record belongs to different company",
        });
        return;
      }

      const validationResult = UpdateAttendanceSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { checkInTime, checkOutTime, status, notes } = validationResult.data;

      const updated = await prisma.attendance.update({
        where: { id: req.params.id },
        data: {
          ...(checkInTime && { checkIn: combineDateAndTime(record.date.toISOString(), checkInTime) }),
          ...(checkOutTime && { checkOut: combineDateAndTime(record.date.toISOString(), checkOutTime) }),
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
        },
      });

      res.status(200).json({
        statusCode: 200,
        data: {
          id: updated.id,
          date: updated.date,
          checkInTime: updated.checkIn,
          checkOutTime: updated.checkOut,
          status: updated.status,
          notes: updated.notes,
        },
        message: "Attendance record updated successfully",
      });
    } catch (error) {
      console.error("Update attendance error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to update attendance",
      });
    }
  }
);

/**
 * DELETE /api/v1/attendance/:id
 * Delete attendance record
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

      const record = await prisma.attendance.findUnique({
        where: { id: req.params.id },
      });

      if (!record || record.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "Attendance record not found",
        });
        return;
      }

      if (record.companyId !== req.user.companyId && req.user.role !== "super_admin") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "Attendance record belongs to different company",
        });
        return;
      }

      await prisma.attendance.delete({
        where: { id: req.params.id },
      });

      res.status(200).json({
        statusCode: 200,
        message: "Attendance record deleted successfully",
      });
    } catch (error) {
      console.error("Delete attendance error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to delete attendance",
      });
    }
  }
);

export default router;
