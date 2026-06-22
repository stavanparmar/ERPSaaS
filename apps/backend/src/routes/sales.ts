import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, authorize } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const CreateCustomerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const CreateSalesOrderSchema = z.object({
  customerId: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive().optional(),
      })
    )
    .min(1),
});

const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  soId: z.string().optional(),
  dueDate: z.string().datetime(),
  totalAmount: z.number().positive().optional(),
  notes: z.string().optional(),
});

const CreatePaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  paymentDate: z.string().datetime().optional(),
  paymentMethod: z.enum(["cash", "check", "bank_transfer", "credit_card"]),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});

function soNumber() {
  return `SO-${Date.now()}`;
}

function invoiceNumber() {
  return `INV-${Date.now()}`;
}

router.get("/customers", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const customers = await prisma.customer.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: customers, message: "Customers retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get customers",
    });
  }
});

router.post(
  "/customers",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreateCustomerSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const customer = await prisma.customer.create({
        data: {
          companyId: req.user.companyId,
          name: validation.data.name,
          email: validation.data.email,
          phone: validation.data.phone,
          address: validation.data.address,
        },
      });

      res.status(201).json({ statusCode: 201, data: customer, message: "Customer created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create customer",
      });
    }
  }
);

router.get("/products", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const products = await prisma.product.findMany({
      where: { companyId: req.user.companyId, deletedAt: null, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: products, message: "Products retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get products",
    });
  }
});

router.get("/orders", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const orders = await prisma.salesOrder.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: orders, message: "Sales orders retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get sales orders",
    });
  }
});

router.post(
  "/orders",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreateSalesOrderSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const { customerId, dueDate, notes, items } = validation.data;

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId: req.user.companyId, deletedAt: null },
      });

      if (!customer) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Customer not found" });
        return;
      }

      const productIds = items.map((x) => x.productId);
      const products = await prisma.product.findMany({
        where: { companyId: req.user.companyId, id: { in: productIds }, deletedAt: null },
      });
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

      let totalAmount = 0;
      for (const item of items) {
        const p = productMap.get(item.productId);
        if (!p) {
          res.status(400).json({ statusCode: 400, error: "Bad Request", message: `Invalid product: ${item.productId}` });
          return;
        }
        if (p.quantity < item.quantity) {
          res.status(400).json({ statusCode: 400, error: "Bad Request", message: `Insufficient stock for ${p.name}` });
          return;
        }
        totalAmount += (item.unitPrice ?? p.sellingPrice) * item.quantity;
      }

      const order = await prisma.$transaction(async (tx: any) => {
        const so = await tx.salesOrder.create({
          data: {
            companyId: req.user!.companyId,
            soNumber: soNumber(),
            customerId,
            status: "pending",
            soDate: new Date(),
            dueDate: dueDate ? new Date(dueDate) : null,
            totalAmount,
            notes: notes ?? null,
          },
        });

        for (const item of items) {
          const p = productMap.get(item.productId)!;
          const unitPrice = item.unitPrice ?? p.sellingPrice;
          const totalPrice = unitPrice * item.quantity;

          await tx.salesItem.create({
            data: {
              soId: so.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice,
              totalPrice,
            },
          });

          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });

          await tx.inventoryTransaction.create({
            data: {
              companyId: req.user!.companyId,
              productId: item.productId,
              type: "out",
              quantity: item.quantity,
              notes: `Sales order ${so.soNumber}`,
            },
          });
        }

        return so;
      });

      res.status(201).json({ statusCode: 201, data: order, message: "Sales order created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create sales order",
      });
    }
  }
);

router.get("/invoices", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const invoices = await prisma.invoice.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        so: { select: { id: true, soNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: invoices, message: "Invoices retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get invoices",
    });
  }
});

router.post(
  "/invoices",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreateInvoiceSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const { customerId, soId, dueDate, totalAmount, notes } = validation.data;

      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId: req.user.companyId, deletedAt: null },
      });
      if (!customer) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Customer not found" });
        return;
      }

      let amount = totalAmount ?? 0;
      if (soId) {
        const so = await prisma.salesOrder.findFirst({
          where: { id: soId, companyId: req.user.companyId, deletedAt: null },
        });
        if (!so) {
          res.status(404).json({ statusCode: 404, error: "Not Found", message: "Sales order not found" });
          return;
        }
        amount = so.totalAmount;
      }

      if (amount <= 0) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: "Invoice total amount must be greater than 0" });
        return;
      }

      const invoice = await prisma.invoice.create({
        data: {
          companyId: req.user.companyId,
          invoiceNumber: invoiceNumber(),
          customerId,
          soId: soId ?? null,
          invoiceDate: new Date(),
          dueDate: new Date(dueDate),
          totalAmount: amount,
          paidAmount: 0,
          status: "issued",
          notes: notes ?? null,
        },
      });

      res.status(201).json({ statusCode: 201, data: invoice, message: "Invoice created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create invoice",
      });
    }
  }
);

router.post(
  "/payments",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreatePaymentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const { invoiceId, amount, paymentDate, paymentMethod, referenceNo, notes } = validation.data;

      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, companyId: req.user.companyId, deletedAt: null },
      });
      if (!invoice) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Invoice not found" });
        return;
      }

      const outstanding = invoice.totalAmount - invoice.paidAmount;
      if (amount > outstanding) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Payment exceeds outstanding amount" });
        return;
      }

      const payment = await prisma.$transaction(async (tx: any) => {
        const p = await tx.payment.create({
          data: {
            companyId: req.user!.companyId,
            invoiceId,
            soId: invoice.soId,
            amount,
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            paymentMethod,
            referenceNo: referenceNo ?? null,
            status: "completed",
            notes: notes ?? null,
          },
        });

        const nextPaid = invoice.paidAmount + amount;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: nextPaid,
            status: nextPaid >= invoice.totalAmount ? "paid" : "issued",
          },
        });

        return p;
      });

      res.status(201).json({ statusCode: 201, data: payment, message: "Payment recorded" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to record payment",
      });
    }
  }
);

export default router;
