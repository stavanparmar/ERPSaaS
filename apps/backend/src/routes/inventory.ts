import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticateToken, authorize } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const CreateCategorySchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  description: z.string().optional(),
});

const CreateSupplierSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
});

const CreateProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(2),
  categoryId: z.string().min(1),
  brand: z.string().optional(),
  unit: z.string().min(1),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().positive(),
  quantity: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  barcode: z.string().optional(),
});

const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
});

const ReceivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        purchaseItemId: z.string().min(1),
        receiveQty: z.number().int().positive(),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

const StockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  type: z.enum(["in", "out", "adjustment"]),
  notes: z.string().optional(),
});

const StockTransferSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
  notes: z.string().optional(),
});

function poNumber() {
  return `PO-${Date.now()}`;
}

router.get("/categories", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: categories, message: "Categories retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get categories",
    });
  }
});

router.post(
  "/categories",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreateCategorySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const existing = await prisma.category.findFirst({
        where: { companyId: req.user.companyId, code: validation.data.code, deletedAt: null },
      });
      if (existing) {
        res.status(409).json({ statusCode: 409, error: "Conflict", message: "Category code already exists" });
        return;
      }

      const category = await prisma.category.create({
        data: {
          companyId: req.user.companyId,
          name: validation.data.name,
          code: validation.data.code,
          description: validation.data.description,
        },
      });

      res.status(201).json({ statusCode: 201, data: category, message: "Category created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create category",
      });
    }
  }
);

router.get("/suppliers", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const suppliers = await prisma.supplier.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: suppliers, message: "Suppliers retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get suppliers",
    });
  }
});

router.post(
  "/suppliers",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreateSupplierSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const supplier = await prisma.supplier.create({
        data: {
          companyId: req.user.companyId,
          name: validation.data.name,
          contactPerson: validation.data.contactPerson,
          email: validation.data.email,
          phone: validation.data.phone,
          address: validation.data.address,
          gstNumber: validation.data.gstNumber,
          status: "active",
        },
      });

      res.status(201).json({ statusCode: 201, data: supplier, message: "Supplier created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create supplier",
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

    const lowStockOnly = String(req.query.lowStockOnly || "false") === "true";

    const allProducts = await prisma.product.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const products = lowStockOnly
      ? allProducts.filter((product: any) => product.quantity <= product.reorderLevel)
      : allProducts;

    res.status(200).json({ statusCode: 200, data: products, message: "Products retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get products",
    });
  }
});

router.post(
  "/products",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreateProductSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const data = validation.data;

      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, companyId: req.user.companyId, deletedAt: null },
      });
      if (!category) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Category not found" });
        return;
      }

      const existing = await prisma.product.findFirst({
        where: { companyId: req.user.companyId, sku: data.sku, deletedAt: null },
      });
      if (existing) {
        res.status(409).json({ statusCode: 409, error: "Conflict", message: "SKU already exists" });
        return;
      }

      const product = await prisma.product.create({
        data: {
          companyId: req.user.companyId,
          sku: data.sku,
          name: data.name,
          categoryId: data.categoryId,
          brand: data.brand,
          unit: data.unit,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          quantity: data.quantity ?? 0,
          reorderLevel: data.reorderLevel ?? 10,
          barcode: data.barcode,
        },
      });

      if ((data.quantity ?? 0) > 0) {
        await prisma.inventoryTransaction.create({
          data: {
            companyId: req.user.companyId,
            productId: product.id,
            type: "in",
            quantity: data.quantity ?? 0,
            notes: "Opening stock",
          },
        });
      }

      res.status(201).json({ statusCode: 201, data: product, message: "Product created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create product",
      });
    }
  }
);

router.post(
  "/transactions/adjust",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = StockAdjustmentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const { productId, quantity, type, notes } = validation.data;

      const product = await prisma.product.findFirst({
        where: { id: productId, companyId: req.user.companyId, deletedAt: null },
      });
      if (!product) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Product not found" });
        return;
      }

      if ((type === "out" || type === "adjustment") && product.quantity < quantity) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Insufficient stock" });
        return;
      }

      const result = await prisma.$transaction(async (tx: any) => {
        const txRecord = await tx.inventoryTransaction.create({
          data: {
            companyId: req.user!.companyId,
            productId,
            type,
            quantity,
            notes: notes ?? null,
          },
        });

        const quantityChange = type === "in" ? quantity : -quantity;
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { quantity: { increment: quantityChange } },
        });

        return { txRecord, updatedProduct };
      });

      res.status(201).json({ statusCode: 201, data: result, message: "Stock adjusted" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to adjust stock",
      });
    }
  }
);

router.get("/transactions", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      include: {
        product: { select: { id: true, sku: true, name: true, quantity: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: transactions, message: "Inventory transactions retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get inventory transactions",
    });
  }
});

router.get("/purchase-orders", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ statusCode: 401, error: "Unauthorized" });
      return;
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { companyId: req.user.companyId, deletedAt: null },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ statusCode: 200, data: purchaseOrders, message: "Purchase orders retrieved" });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Failed to get purchase orders",
    });
  }
});

router.post(
  "/purchase-orders",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = CreatePurchaseOrderSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const { supplierId, dueDate, notes, items } = validation.data;

      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, companyId: req.user.companyId, deletedAt: null },
      });
      if (!supplier) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Supplier not found" });
        return;
      }

      const productIds = items.map((x) => x.productId);
      const products = await prisma.product.findMany({
        where: { companyId: req.user.companyId, id: { in: productIds }, deletedAt: null },
      });
      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

      for (const item of items) {
        if (!productMap.get(item.productId)) {
          res.status(400).json({ statusCode: 400, error: "Bad Request", message: `Invalid product: ${item.productId}` });
          return;
        }
      }

      const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const purchaseOrder = await prisma.$transaction(async (tx: any) => {
        const po = await tx.purchaseOrder.create({
          data: {
            companyId: req.user!.companyId,
            poNumber: poNumber(),
            supplierId,
            status: "pending",
            poDate: new Date(),
            dueDate: dueDate ? new Date(dueDate) : null,
            totalAmount,
            notes: notes ?? null,
          },
        });

        for (const item of items) {
          await tx.purchaseItem.create({
            data: {
              poId: po.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              receivedQty: 0,
            },
          });
        }

        return po;
      });

      res.status(201).json({ statusCode: 201, data: purchaseOrder, message: "Purchase order created" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create purchase order",
      });
    }
  }
);

router.patch(
  "/purchase-orders/:id/receive",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = ReceivePurchaseOrderSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: { id: req.params.id, companyId: req.user.companyId, deletedAt: null },
        include: { items: true },
      });
      if (!purchaseOrder) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Purchase order not found" });
        return;
      }

      const itemsMap = new Map<string, any>(purchaseOrder.items.map((item: any) => [item.id, item]));
      for (const item of validation.data.items) {
        const poItem = itemsMap.get(item.purchaseItemId);
        if (!poItem) {
          res.status(400).json({ statusCode: 400, error: "Bad Request", message: `Invalid purchase item: ${item.purchaseItemId}` });
          return;
        }
        const remaining = poItem.quantity - poItem.receivedQty;
        if (item.receiveQty > remaining) {
          res.status(400).json({
            statusCode: 400,
            error: "Bad Request",
            message: `Receive quantity exceeds remaining for item ${item.purchaseItemId}`,
          });
          return;
        }
      }

      const result = await prisma.$transaction(async (tx: any) => {
        for (const item of validation.data.items) {
          const poItem = itemsMap.get(item.purchaseItemId)!;

          await tx.purchaseItem.update({
            where: { id: poItem.id },
            data: { receivedQty: { increment: item.receiveQty } },
          });

          await tx.product.update({
            where: { id: poItem.productId },
            data: { quantity: { increment: item.receiveQty } },
          });

          await tx.inventoryTransaction.create({
            data: {
              companyId: req.user!.companyId,
              productId: poItem.productId,
              type: "in",
              quantity: item.receiveQty,
              notes: validation.data.notes ?? `Received against PO ${purchaseOrder.poNumber}`,
            },
          });
        }

        const refreshedItems = await tx.purchaseItem.findMany({ where: { poId: purchaseOrder.id } });
        const isFullyReceived = refreshedItems.every((item: any) => item.receivedQty >= item.quantity);

        const updatedPo = await tx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: { status: isFullyReceived ? "received" : "approved" },
        });

        return updatedPo;
      });

      res.status(200).json({ statusCode: 200, data: result, message: "Purchase order receipt recorded" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to receive purchase order",
      });
    }
  }
);

router.post(
  "/transfers",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized" });
        return;
      }

      const validation = StockTransferSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ statusCode: 400, error: "Validation Error", message: validation.error.errors[0].message });
        return;
      }

      const { productId, quantity, fromLocation, toLocation, notes } = validation.data;

      if (fromLocation === toLocation) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "From and to location must differ" });
        return;
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, companyId: req.user.companyId, deletedAt: null },
      });
      if (!product) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Product not found" });
        return;
      }

      if (product.quantity < quantity) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Insufficient stock for transfer" });
        return;
      }

      const transferNote = notes ?? `Stock transfer ${fromLocation} -> ${toLocation}`;

      const transfer = await prisma.$transaction(async (tx: any) => {
        const outTx = await tx.inventoryTransaction.create({
          data: {
            companyId: req.user!.companyId,
            productId,
            type: "out",
            quantity,
            notes: `${transferNote} (out)`,
          },
        });

        const inTx = await tx.inventoryTransaction.create({
          data: {
            companyId: req.user!.companyId,
            productId,
            type: "in",
            quantity,
            notes: `${transferNote} (in)`,
          },
        });

        return { outTx, inTx };
      });

      res.status(201).json({ statusCode: 201, data: transfer, message: "Stock transfer recorded" });
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to record stock transfer",
      });
    }
  }
);

export default router;
