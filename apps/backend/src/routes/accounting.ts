import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, authorize } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const CreateJournalEntrySchema = z.object({
  entryDate: z.string().datetime(),
  description: z.string().min(3),
  reference: z.string().optional(),
  totalDebit: z.number().nonnegative(),
  totalCredit: z.number().nonnegative(),
  status: z.enum(["draft", "posted", "reversed"]).optional(),
});

const UpdateJournalStatusSchema = z.object({
  status: z.enum(["draft", "posted", "reversed"]),
});

router.get("/journal-entries", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        companyId: req.user.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(fromDate || toDate
          ? {
              entryDate: {
                ...(fromDate ? { gte: new Date(fromDate) } : {}),
                ...(toDate ? { lte: new Date(toDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { entryDate: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: journalEntries, message: "Journal entries retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to retrieve journal entries",
    });
  }
});

router.post(
  "/journal-entries",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreateJournalEntrySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const data = validation.data;
      if (Math.abs(data.totalDebit - data.totalCredit) > 0.001) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: "Journal entry is not balanced: totalDebit must equal totalCredit",
        });
        return;
      }

      const entry = await prisma.journalEntry.create({
        data: {
          companyId: req.user.companyId,
          entryDate: new Date(data.entryDate),
          description: data.description,
          reference: data.reference ?? null,
          totalDebit: data.totalDebit,
          totalCredit: data.totalCredit,
          status: data.status ?? "draft",
        },
      });

      res.status(201).json({ statusCode: 201, data: entry, message: "Journal entry created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create journal entry",
      });
    }
  }
);

router.patch(
  "/journal-entries/:id/status",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = UpdateJournalStatusSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const existing = await prisma.journalEntry.findFirst({
        where: { id: req.params.id, companyId: req.user.companyId, deletedAt: null },
      });
      if (!existing) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Journal entry not found" });
        return;
      }

      const updated = await prisma.journalEntry.update({
        where: { id: existing.id },
        data: { status: validation.data.status },
      });

      res.status(200).json({ statusCode: 200, data: updated, message: "Journal status updated" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to update journal status",
      });
    }
  }
);

router.get("/ledger", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId: req.user.companyId,
        deletedAt: null,
        status: "posted",
        ...(fromDate || toDate
          ? {
              entryDate: {
                ...(fromDate ? { gte: new Date(fromDate) } : {}),
                ...(toDate ? { lte: new Date(toDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { entryDate: "asc" },
    });

    const totals = entries.reduce(
      (acc: { totalDebit: number; totalCredit: number }, entry: { totalDebit: number; totalCredit: number }) => {
        acc.totalDebit += entry.totalDebit;
        acc.totalCredit += entry.totalCredit;
        return acc;
      },
      { totalDebit: 0, totalCredit: 0 }
    );

    res.status(200).json({
      statusCode: 200,
      data: {
        entries,
        summary: {
          totalDebit: totals.totalDebit,
          totalCredit: totals.totalCredit,
          balance: totals.totalDebit - totals.totalCredit,
        },
      },
      message: "General ledger retrieved",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to retrieve general ledger",
    });
  }
});

router.get("/trial-balance", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId: req.user.companyId,
        deletedAt: null,
        status: "posted",
        ...(fromDate || toDate
          ? {
              entryDate: {
                ...(fromDate ? { gte: new Date(fromDate) } : {}),
                ...(toDate ? { lte: new Date(toDate) } : {}),
              },
            }
          : {}),
      },
      select: { totalDebit: true, totalCredit: true },
    });

    const trial = entries.reduce(
      (acc: { debit: number; credit: number }, entry: { totalDebit: number; totalCredit: number }) => {
        acc.debit += entry.totalDebit;
        acc.credit += entry.totalCredit;
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    res.status(200).json({
      statusCode: 200,
      data: {
        totalDebit: trial.debit,
        totalCredit: trial.credit,
        difference: trial.debit - trial.credit,
        isBalanced: Math.abs(trial.debit - trial.credit) <= 0.001,
      },
      message: "Trial balance generated",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to generate trial balance",
    });
  }
});

router.get("/financial-reports", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const dateFilter = fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: new Date(fromDate) } : {}),
            ...(toDate ? { lte: new Date(toDate) } : {}),
          },
        }
      : {};

    const [invoiceAgg, paymentAgg, purchaseAgg, payrollAgg, postedJournalAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          companyId: req.user.companyId,
          deletedAt: null,
          ...dateFilter,
        },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          companyId: req.user.companyId,
          deletedAt: null,
          status: "completed",
          ...dateFilter,
        },
        _sum: { amount: true },
      }),
      prisma.purchaseOrder.aggregate({
        where: {
          companyId: req.user.companyId,
          deletedAt: null,
          ...dateFilter,
        },
        _sum: { totalAmount: true },
      }),
      prisma.payroll.aggregate({
        where: {
          companyId: req.user.companyId,
          deletedAt: null,
          status: { in: ["approved", "paid"] },
          ...dateFilter,
        },
        _sum: { netSalary: true },
      }),
      prisma.journalEntry.aggregate({
        where: {
          companyId: req.user.companyId,
          deletedAt: null,
          status: "posted",
          ...(fromDate || toDate
            ? {
                entryDate: {
                  ...(fromDate ? { gte: new Date(fromDate) } : {}),
                  ...(toDate ? { lte: new Date(toDate) } : {}),
                },
              }
            : {}),
        },
        _sum: { totalDebit: true, totalCredit: true },
      }),
    ]);

    const revenue = invoiceAgg._sum.totalAmount ?? 0;
    const receivablesCollected = paymentAgg._sum.amount ?? 0;
    const procurementCost = purchaseAgg._sum.totalAmount ?? 0;
    const payrollCost = payrollAgg._sum.netSalary ?? 0;
    const operatingCost = procurementCost + payrollCost;

    res.status(200).json({
      statusCode: 200,
      data: {
        period: {
          fromDate: fromDate ?? null,
          toDate: toDate ?? null,
        },
        profitAndLoss: {
          revenue,
          operatingCost,
          netProfit: revenue - operatingCost,
        },
        cashAndReceivables: {
          receivablesCollected,
          outstandingReceivables: revenue - receivablesCollected,
        },
        journalControl: {
          postedDebit: postedJournalAgg._sum.totalDebit ?? 0,
          postedCredit: postedJournalAgg._sum.totalCredit ?? 0,
        },
      },
      message: "Financial report generated",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to generate financial report",
    });
  }
});

export default router;
