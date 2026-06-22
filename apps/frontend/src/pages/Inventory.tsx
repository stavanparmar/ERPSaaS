import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type Category = {
  id: string;
  name: string;
  code: string;
};

type Supplier = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  category?: { id: string; name: string; code: string };
};

type PurchaseItem = {
  id: string;
  quantity: number;
  receivedQty: number;
  product: { id: string; name: string; sku: string };
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  supplier: { id: string; name: string };
  items: PurchaseItem[];
};

type InventoryTx = {
  id: string;
  type: string;
  quantity: number;
  notes?: string;
  createdAt: string;
  product: { id: string; sku: string; name: string };
};

const Inventory = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [transactions, setTransactions] = useState<InventoryTx[]>([]);

  const [categoryForm, setCategoryForm] = useState({ name: "", code: "", description: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", email: "", phone: "" });
  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    categoryId: "",
    unit: "pcs",
    costPrice: "0",
    sellingPrice: "0",
    quantity: "0",
    reorderLevel: "10",
  });
  const [adjustForm, setAdjustForm] = useState({ productId: "", type: "in", quantity: "1", notes: "" });
  const [poForm, setPoForm] = useState({ supplierId: "", productId: "", quantity: "1", unitPrice: "0", notes: "" });
  const [receiveQtyByItem, setReceiveQtyByItem] = useState<Record<string, string>>({});
  const [transferForm, setTransferForm] = useState({ productId: "", quantity: "1", fromLocation: "Main", toLocation: "Warehouse-2", notes: "" });

  const lowStockCount = useMemo(() => products.filter((p) => p.quantity <= p.reorderLevel).length, [products]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, supplierRes, productRes, poRes, txRes] = await Promise.all([
        apiClient.get("/inventory/categories"),
        apiClient.get("/inventory/suppliers"),
        apiClient.get("/inventory/products"),
        apiClient.get("/inventory/purchase-orders"),
        apiClient.get("/inventory/transactions"),
      ]);

      setCategories(catRes.data?.data ?? []);
      setSuppliers(supplierRes.data?.data ?? []);
      setProducts(productRes.data?.data ?? []);
      setPurchaseOrders(poRes.data?.data ?? []);
      setTransactions(txRes.data?.data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load inventory data";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const submitCategory = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/inventory/categories", categoryForm);
      setCategoryForm({ name: "", code: "", description: "" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  const submitSupplier = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/inventory/suppliers", supplierForm);
      setSupplierForm({ name: "", email: "", phone: "" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create supplier");
    }
  };

  const submitProduct = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/inventory/products", {
        ...productForm,
        costPrice: Number(productForm.costPrice),
        sellingPrice: Number(productForm.sellingPrice),
        quantity: Number(productForm.quantity),
        reorderLevel: Number(productForm.reorderLevel),
      });
      setProductForm({
        sku: "",
        name: "",
        categoryId: "",
        unit: "pcs",
        costPrice: "0",
        sellingPrice: "0",
        quantity: "0",
        reorderLevel: "10",
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    }
  };

  const submitStockAdjustment = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/inventory/transactions/adjust", {
        ...adjustForm,
        quantity: Number(adjustForm.quantity),
      });
      setAdjustForm({ productId: "", type: "in", quantity: "1", notes: "" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    }
  };

  const submitPurchaseOrder = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/inventory/purchase-orders", {
        supplierId: poForm.supplierId,
        notes: poForm.notes || undefined,
        items: [
          {
            productId: poForm.productId,
            quantity: Number(poForm.quantity),
            unitPrice: Number(poForm.unitPrice),
          },
        ],
      });
      setPoForm({ supplierId: "", productId: "", quantity: "1", unitPrice: "0", notes: "" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create purchase order");
    }
  };

  const receivePurchaseOrder = async (po: PurchaseOrder) => {
    try {
      const receiveItems = po.items
        .map((item) => {
          const remaining = item.quantity - item.receivedQty;
          const input = Number(receiveQtyByItem[item.id] ?? 0);
          const qty = input > 0 ? Math.min(input, remaining) : 0;
          if (qty <= 0) {
            return null;
          }
          return { purchaseItemId: item.id, receiveQty: qty };
        })
        .filter((item): item is { purchaseItemId: string; receiveQty: number } => item !== null);

      if (receiveItems.length === 0) {
        setError("Enter at least one receive quantity");
        return;
      }

      await apiClient.patch(`/inventory/purchase-orders/${po.id}/receive`, {
        items: receiveItems,
      });
      setReceiveQtyByItem({});
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to receive purchase order");
    }
  };

  const submitTransfer = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/inventory/transfers", {
        ...transferForm,
        quantity: Number(transferForm.quantity),
      });
      setTransferForm({ productId: "", quantity: "1", fromLocation: "Main", toLocation: "Warehouse-2", notes: "" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record transfer");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-600">Products, purchase orders, stock transactions, and transfers.</p>
        </div>
        <button
          onClick={() => void loadData()}
          className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-black"
        >
          Refresh
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white border p-4">
          <p className="text-sm text-gray-500">Products</p>
          <p className="text-2xl font-semibold text-gray-900">{products.length}</p>
        </div>
        <div className="rounded-lg bg-white border p-4">
          <p className="text-sm text-gray-500">Low Stock</p>
          <p className="text-2xl font-semibold text-amber-600">{lowStockCount}</p>
        </div>
        <div className="rounded-lg bg-white border p-4">
          <p className="text-sm text-gray-500">Purchase Orders</p>
          <p className="text-2xl font-semibold text-gray-900">{purchaseOrders.length}</p>
        </div>
        <div className="rounded-lg bg-white border p-4">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-2xl font-semibold text-gray-900">{transactions.length}</p>
        </div>
      </div>

      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={submitCategory} className="rounded-lg border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Create Category</h2>
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" placeholder="Name" value={categoryForm.name} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))} required />
              <input className="border rounded px-3 py-2" placeholder="Code" value={categoryForm.code} onChange={(e) => setCategoryForm((prev) => ({ ...prev, code: e.target.value }))} required />
            </div>
            <input className="border rounded px-3 py-2 w-full" placeholder="Description" value={categoryForm.description} onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))} />
            <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" type="submit">Create Category</button>
          </form>

          <form onSubmit={submitSupplier} className="rounded-lg border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Create Supplier</h2>
            <input className="border rounded px-3 py-2 w-full" placeholder="Supplier name" value={supplierForm.name} onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" placeholder="Email" value={supplierForm.email} onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))} />
              <input className="border rounded px-3 py-2" placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" type="submit">Create Supplier</button>
          </form>

          <form onSubmit={submitProduct} className="rounded-lg border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Create Product</h2>
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" placeholder="SKU" value={productForm.sku} onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))} required />
              <input className="border rounded px-3 py-2" placeholder="Name" value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </div>
            <select className="border rounded px-3 py-2 w-full" value={productForm.categoryId} onChange={(e) => setProductForm((prev) => ({ ...prev, categoryId: e.target.value }))} required>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name} ({category.code})</option>
              ))}
            </select>
            <div className="grid grid-cols-4 gap-3">
              <input className="border rounded px-3 py-2" placeholder="Unit" value={productForm.unit} onChange={(e) => setProductForm((prev) => ({ ...prev, unit: e.target.value }))} required />
              <input className="border rounded px-3 py-2" type="number" min="0" step="0.01" placeholder="Cost" value={productForm.costPrice} onChange={(e) => setProductForm((prev) => ({ ...prev, costPrice: e.target.value }))} required />
              <input className="border rounded px-3 py-2" type="number" min="0" step="0.01" placeholder="Sell" value={productForm.sellingPrice} onChange={(e) => setProductForm((prev) => ({ ...prev, sellingPrice: e.target.value }))} required />
              <input className="border rounded px-3 py-2" type="number" min="0" step="1" placeholder="Qty" value={productForm.quantity} onChange={(e) => setProductForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
            </div>
            <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" type="submit">Create Product</button>
          </form>

          <form onSubmit={submitStockAdjustment} className="rounded-lg border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Stock Adjustment</h2>
            <select className="border rounded px-3 py-2 w-full" value={adjustForm.productId} onChange={(e) => setAdjustForm((prev) => ({ ...prev, productId: e.target.value }))} required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.sku} - {product.name} (qty: {product.quantity})</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <select className="border rounded px-3 py-2" value={adjustForm.type} onChange={(e) => setAdjustForm((prev) => ({ ...prev, type: e.target.value }))}>
                <option value="in">In</option>
                <option value="out">Out</option>
                <option value="adjustment">Adjustment</option>
              </select>
              <input className="border rounded px-3 py-2" type="number" min="1" step="1" value={adjustForm.quantity} onChange={(e) => setAdjustForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
              <input className="border rounded px-3 py-2" placeholder="Notes" value={adjustForm.notes} onChange={(e) => setAdjustForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
            <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" type="submit">Adjust Stock</button>
          </form>

          <form onSubmit={submitPurchaseOrder} className="rounded-lg border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Create Purchase Order</h2>
            <select className="border rounded px-3 py-2 w-full" value={poForm.supplierId} onChange={(e) => setPoForm((prev) => ({ ...prev, supplierId: e.target.value }))} required>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
            <select className="border rounded px-3 py-2 w-full" value={poForm.productId} onChange={(e) => setPoForm((prev) => ({ ...prev, productId: e.target.value }))} required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" type="number" min="1" step="1" placeholder="Quantity" value={poForm.quantity} onChange={(e) => setPoForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
              <input className="border rounded px-3 py-2" type="number" min="0" step="0.01" placeholder="Unit price" value={poForm.unitPrice} onChange={(e) => setPoForm((prev) => ({ ...prev, unitPrice: e.target.value }))} required />
            </div>
            <input className="border rounded px-3 py-2 w-full" placeholder="Notes" value={poForm.notes} onChange={(e) => setPoForm((prev) => ({ ...prev, notes: e.target.value }))} />
            <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" type="submit">Create PO</button>
          </form>

          <form onSubmit={submitTransfer} className="rounded-lg border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Stock Transfer</h2>
            <select className="border rounded px-3 py-2 w-full" value={transferForm.productId} onChange={(e) => setTransferForm((prev) => ({ ...prev, productId: e.target.value }))} required>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <input className="border rounded px-3 py-2" type="number" min="1" step="1" value={transferForm.quantity} onChange={(e) => setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
              <input className="border rounded px-3 py-2" placeholder="From" value={transferForm.fromLocation} onChange={(e) => setTransferForm((prev) => ({ ...prev, fromLocation: e.target.value }))} required />
              <input className="border rounded px-3 py-2" placeholder="To" value={transferForm.toLocation} onChange={(e) => setTransferForm((prev) => ({ ...prev, toLocation: e.target.value }))} required />
            </div>
            <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" type="submit">Record Transfer</button>
          </form>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Recent Products</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left bg-gray-50">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 12).map((product) => (
                <tr key={product.id} className="border-t">
                  <td className="px-3 py-2">{product.sku}</td>
                  <td className="px-3 py-2">{product.name}</td>
                  <td className="px-3 py-2">{product.category?.name ?? "-"}</td>
                  <td className={`px-3 py-2 ${product.quantity <= product.reorderLevel ? "text-amber-600 font-semibold" : "text-gray-700"}`}>{product.quantity}</td>
                  <td className="px-3 py-2">{product.reorderLevel}</td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={5}>{loading ? "Loading..." : "No products found"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Purchase Orders</h2>
        <div className="space-y-4">
          {purchaseOrders.slice(0, 6).map((po) => (
            <div key={po.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{po.poNumber} - {po.supplier.name}</p>
                  <p className="text-sm text-gray-600">Status: {po.status} | Total: {po.totalAmount.toFixed(2)}</p>
                </div>
                <button
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!isAdmin || po.status === "received"}
                  onClick={() => void receivePurchaseOrder(po)}
                >
                  Receive Selected
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                {po.items.map((item) => {
                  const remaining = item.quantity - item.receivedQty;
                  return (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-6">{item.product.sku} - {item.product.name}</div>
                      <div className="col-span-3 text-gray-600">Remaining: {remaining}</div>
                      <input
                        className="col-span-3 border rounded px-2 py-1"
                        type="number"
                        min="0"
                        max={remaining}
                        step="1"
                        value={receiveQtyByItem[item.id] ?? ""}
                        onChange={(e) => setReceiveQtyByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Receive qty"
                        disabled={!isAdmin || remaining <= 0}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!purchaseOrders.length && <p className="text-sm text-gray-500">No purchase orders available.</p>}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Recent Transactions</h2>
        <div className="space-y-2 text-sm">
          {transactions.slice(0, 12).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <p className="text-gray-900">
                  {tx.product.sku} - {tx.product.name} | {tx.type.toUpperCase()} x {tx.quantity}
                </p>
                <p className="text-gray-600">{tx.notes || "-"}</p>
              </div>
              <span className="text-gray-500">{new Date(tx.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {!transactions.length && <p className="text-gray-500">No transactions available.</p>}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
