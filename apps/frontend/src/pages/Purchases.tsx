import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type Supplier = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
};

type PurchaseItem = {
  id: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  supplier: {
    id: string;
    name: string;
  };
  items: PurchaseItem[];
};

const Purchases = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    supplierId: "",
    productId: "",
    quantity: "1",
    unitPrice: "0",
    notes: "",
  });

  const [receiveQtyByItem, setReceiveQtyByItem] = useState<Record<string, string>>({});

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [supplierRes, productRes, poRes] = await Promise.all([
        apiClient.get("/inventory/suppliers"),
        apiClient.get("/inventory/products"),
        apiClient.get("/inventory/purchase-orders"),
      ]);

      setSuppliers(supplierRes.data?.data ?? []);
      setProducts(productRes.data?.data ?? []);
      setPurchaseOrders(poRes.data?.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load purchases data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createPurchaseOrder = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await apiClient.post("/inventory/purchase-orders", {
        supplierId: form.supplierId,
        notes: form.notes || undefined,
        items: [
          {
            productId: form.productId,
            quantity: Number(form.quantity),
            unitPrice: Number(form.unitPrice),
          },
        ],
      });

      setForm({ supplierId: "", productId: "", quantity: "1", unitPrice: "0", notes: "" });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create purchase order");
    }
  };

  const receivePurchaseOrder = async (po: PurchaseOrder) => {
    setError("");
    try {
      const receiveItems = po.items
        .map((item) => {
          const remaining = item.quantity - item.receivedQty;
          const enteredQty = Number(receiveQtyByItem[item.id] ?? 0);
          const qty = enteredQty > 0 ? Math.min(enteredQty, remaining) : 0;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-600">Create and receive purchase orders.</p>
        </div>
        <button
          onClick={() => void loadData()}
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-black"
        >
          Refresh
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Suppliers</p>
          <p className="text-2xl font-semibold text-gray-900">{suppliers.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Products</p>
          <p className="text-2xl font-semibold text-gray-900">{products.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Purchase Orders</p>
          <p className="text-2xl font-semibold text-gray-900">{purchaseOrders.length}</p>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={createPurchaseOrder} className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Create Purchase Order</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <select
              className="rounded border px-3 py-2"
              value={form.supplierId}
              onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}
              required
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-3 py-2"
              value={form.productId}
              onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
              required
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))}
            </select>
            <input
              className="rounded border px-3 py-2"
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              placeholder="Quantity"
              required
            />
            <input
              className="rounded border px-3 py-2"
              type="number"
              min="0"
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
              placeholder="Unit Price"
              required
            />
          </div>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes (optional)"
          />
          <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" type="submit">
            Create Purchase Order
          </button>
        </form>
      )}

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Purchase Orders</h2>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading purchase orders...</div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-sm text-gray-500">No purchase orders yet.</div>
        ) : (
          <div className="space-y-4">
            {purchaseOrders.map((po) => (
              <div key={po.id} className="rounded border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{po.poNumber}</p>
                    <p className="text-sm text-gray-600">{po.supplier.name}</p>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p className="font-medium text-gray-900">{po.totalAmount.toFixed(2)}</p>
                    <p>{po.status}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {po.items.map((item) => {
                    const remaining = item.quantity - item.receivedQty;
                    return (
                      <div key={item.id} className="grid gap-2 border-t pt-2 text-sm md:grid-cols-5 md:items-center">
                        <div className="md:col-span-2">
                          {item.product.name} ({item.product.sku})
                        </div>
                        <div>
                          Ordered: {item.quantity}
                        </div>
                        <div>
                          Received: {item.receivedQty}
                        </div>
                        <input
                          className="rounded border px-2 py-1"
                          type="number"
                          min="0"
                          max={remaining}
                          step="1"
                          placeholder={`Receive (${remaining})`}
                          value={receiveQtyByItem[item.id] ?? ""}
                          onChange={(e) =>
                            setReceiveQtyByItem((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <button
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                    onClick={() => void receivePurchaseOrder(po)}
                  >
                    Receive Items
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Purchases;
