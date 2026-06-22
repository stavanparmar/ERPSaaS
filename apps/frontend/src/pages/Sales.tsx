import { useEffect, useState } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  status: string;
  totalAmount: number;
  soDate: string;
  customer: { id: string; name: string; email: string };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  customer: { id: string; name: string; email: string };
}

const Sales = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [customerForm, setCustomerForm] = useState({ name: "", email: "" });
  const [orderForm, setOrderForm] = useState({ customerId: "", productId: "", quantity: "1" });
  const [invoiceForm, setInvoiceForm] = useState({ customerId: "", soId: "", dueDate: "" });
  const [paymentForm, setPaymentForm] = useState({ invoiceId: "", amount: "", paymentMethod: "cash" });

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [c, p, o, i] = await Promise.all([
        apiClient.get("/sales/customers"),
        apiClient.get("/sales/products"),
        apiClient.get("/sales/orders"),
        apiClient.get("/sales/invoices"),
      ]);
      setCustomers(c.data.data || []);
      setProducts(p.data.data || []);
      setOrders(o.data.data || []);
      setInvoices(i.data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/sales/customers", customerForm);
      setCustomerForm({ name: "", email: "" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    }
  };

  const addOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/sales/orders", {
        customerId: orderForm.customerId,
        items: [{ productId: orderForm.productId, quantity: Number(orderForm.quantity) }],
      });
      setOrderForm({ customerId: "", productId: "", quantity: "1" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sales order");
    }
  };

  const addInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/sales/invoices", {
        customerId: invoiceForm.customerId,
        soId: invoiceForm.soId || undefined,
        dueDate: new Date(invoiceForm.dueDate).toISOString(),
      });
      setInvoiceForm({ customerId: "", soId: "", dueDate: "" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/sales/payments", {
        invoiceId: paymentForm.invoiceId,
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
      });
      setPaymentForm({ invoiceId: "", amount: "", paymentMethod: "cash" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Sales & Invoicing</h1>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>}

      {isLoading ? (
        <div className="text-gray-600">Loading sales data...</div>
      ) : (
        <>
          {isAdmin && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <form onSubmit={addCustomer} className="rounded-lg border border-gray-300 bg-white p-4 space-y-3">
                <h2 className="font-semibold">Add Customer</h2>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Customer Name"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm((s) => ({ ...s, name: e.target.value }))}
                  required
                />
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Customer Email"
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm((s) => ({ ...s, email: e.target.value }))}
                  required
                />
                <button className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm">Create Customer</button>
              </form>

              <form onSubmit={addOrder} className="rounded-lg border border-gray-300 bg-white p-4 space-y-3">
                <h2 className="font-semibold">Create Sales Order</h2>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={orderForm.customerId}
                  onChange={(e) => setOrderForm((s) => ({ ...s, customerId: e.target.value }))}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={orderForm.productId}
                  onChange={(e) => setOrderForm((s) => ({ ...s, productId: e.target.value }))}
                  required
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.quantity} in stock)</option>
                  ))}
                </select>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  type="number"
                  min="1"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm((s) => ({ ...s, quantity: e.target.value }))}
                  required
                />
                <button className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm">Create Order</button>
              </form>

              <form onSubmit={addInvoice} className="rounded-lg border border-gray-300 bg-white p-4 space-y-3">
                <h2 className="font-semibold">Create Invoice</h2>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={invoiceForm.customerId}
                  onChange={(e) => setInvoiceForm((s) => ({ ...s, customerId: e.target.value }))}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={invoiceForm.soId}
                  onChange={(e) => setInvoiceForm((s) => ({ ...s, soId: e.target.value }))}
                >
                  <option value="">Optional Sales Order</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>{o.soNumber}</option>
                  ))}
                </select>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm((s) => ({ ...s, dueDate: e.target.value }))}
                  required
                />
                <button className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm">Create Invoice</button>
              </form>

              <form onSubmit={recordPayment} className="rounded-lg border border-gray-300 bg-white p-4 space-y-3">
                <h2 className="font-semibold">Record Payment</h2>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={paymentForm.invoiceId}
                  onChange={(e) => setPaymentForm((s) => ({ ...s, invoiceId: e.target.value }))}
                  required
                >
                  <option value="">Select Invoice</option>
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>{i.invoiceNumber} ({(i.totalAmount - i.paidAmount).toFixed(2)} due)</option>
                  ))}
                </select>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Amount"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
                  required
                />
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm((s) => ({ ...s, paymentMethod: e.target.value }))}
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                </select>
                <button className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm">Record Payment</button>
              </form>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="font-semibold mb-3">Recent Sales Orders</h2>
            <div className="space-y-2 text-sm">
              {orders.length === 0 ? <div className="text-gray-500">No sales orders yet.</div> : orders.slice(0, 10).map((o) => (
                <div key={o.id} className="flex justify-between border-b pb-2">
                  <span>{o.soNumber} - {o.customer.name}</span>
                  <span>{o.totalAmount.toFixed(2)} ({o.status})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="font-semibold mb-3">Recent Invoices</h2>
            <div className="space-y-2 text-sm">
              {invoices.length === 0 ? <div className="text-gray-500">No invoices yet.</div> : invoices.slice(0, 10).map((inv) => (
                <div key={inv.id} className="flex justify-between border-b pb-2">
                  <span>{inv.invoiceNumber} - {inv.customer.name}</span>
                  <span>{inv.paidAmount.toFixed(2)} / {inv.totalAmount.toFixed(2)} ({inv.status})</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Sales;
