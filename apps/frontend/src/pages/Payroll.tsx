import { useEffect, useState } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type PayrollStatus = "draft" | "approved" | "paid" | "cancelled";

interface PayrollItem {
  id: string;
  employeeId: string;
  month: string;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  taxes: number;
  netSalary: number;
  status: PayrollStatus;
  notes?: string;
  employee?: {
    id: string;
    employeeId: string;
    name: string;
    email: string;
  };
}

interface EmployeeOption {
  id: string;
  employeeId: string;
  user: {
    firstName: string;
    lastName: string;
  };
  salary?: number;
}

const defaultForm = {
  employeeId: "",
  month: new Date().toISOString().slice(0, 7),
  baseSalary: "",
  bonuses: "0",
  deductions: "0",
  taxes: "0",
  notes: "",
};

const Payroll = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [records, setRecords] = useState<PayrollItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [formData, setFormData] = useState(defaultForm);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadRecords = async () => {
    setIsLoading(true);
    setError("");

    try {
      const endpoint = isAdmin ? "/payrolls" : "/payrolls/my";
      const response = await apiClient.get(endpoint, {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setRecords(response.data.data || []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (!isAdmin && status === 404) {
        setRecords([]);
        setError("Your account does not have a linked employee profile yet. Please contact your administrator.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load payroll records");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (!isAdmin) return;

    try {
      const response = await apiClient.get("/employees");
      setEmployees(response.data.data || []);
    } catch {
      setEmployees([]);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [isAdmin, statusFilter]);

  useEffect(() => {
    loadEmployees();
  }, [isAdmin]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const createPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await apiClient.post("/payrolls", {
        employeeId: formData.employeeId,
        month: formData.month,
        baseSalary: formData.baseSalary ? Number(formData.baseSalary) : undefined,
        bonuses: Number(formData.bonuses || 0),
        deductions: Number(formData.deductions || 0),
        taxes: Number(formData.taxes || 0),
        notes: formData.notes || undefined,
      });

      setFormData(defaultForm);
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payroll record");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: PayrollStatus) => {
    try {
      await apiClient.patch(`/payrolls/${id}`, { status });
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payroll status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>
      )}

      {isAdmin && (
        <div className="rounded-lg border border-gray-300 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Create Payroll Record</h2>
          <form onSubmit={createPayroll} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee</label>
                <select
                  name="employeeId"
                  required
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user.firstName} {emp.user.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Month</label>
                <input
                  type="month"
                  name="month"
                  required
                  value={formData.month}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Base Salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="baseSalary"
                  value={formData.baseSalary}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bonuses</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="bonuses"
                  value={formData.bonuses}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Deductions</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="deductions"
                  value={formData.deductions}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Taxes</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="taxes"
                  value={formData.taxes}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              {isSubmitting ? "Creating..." : "Create Payroll"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Month
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Base
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Net
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-sm text-gray-500">
                  Loading payroll records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-sm text-gray-500">
                  No payroll records found.
                </td>
              </tr>
            ) : (
              records.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.employee?.name || "Self"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(item.month).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{item.baseSalary.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {item.netSalary.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 space-x-2">
                    {isAdmin && item.status === "draft" && (
                      <>
                        <button
                          onClick={() => updateStatus(item.id, "approved")}
                          className="text-green-700 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(item.id, "cancelled")}
                          className="text-red-700 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {isAdmin && item.status === "approved" && (
                      <button
                        onClick={() => updateStatus(item.id, "paid")}
                        className="text-indigo-700 hover:text-indigo-900"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Payroll;
