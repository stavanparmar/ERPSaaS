import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

type LeaveType =
  | "casual"
  | "sick"
  | "earned"
  | "maternity"
  | "paternity"
  | "unpaid"
  | "other";

interface LeaveItem {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason?: string;
  createdAt: string;
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
}

const defaultForm = {
  employeeId: "",
  leaveType: "casual" as LeaveType,
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date().toISOString().split("T")[0],
  reason: "",
};

const Leaves = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [formData, setFormData] = useState(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [noProfileWarning, setNoProfileWarning] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const loadLeaves = async () => {
    setIsLoading(true);
    setError("");
    setNoProfileWarning(false);

    try {
      const endpoint = isAdmin ? "/leaves" : "/leaves/my";
      const response = await apiClient.get(endpoint, {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setLeaves(response.data.data || []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (!isAdmin && status === 404) {
        setNoProfileWarning(true);
        setLeaves([]);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load leave requests");
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
    loadLeaves();
  }, [statusFilter, isAdmin]);

  useEffect(() => {
    loadEmployees();
  }, [isAdmin]);

  const leaveSummary = useMemo(() => {
    return {
      pending: leaves.filter((x) => x.status === "pending").length,
      approved: leaves.filter((x) => x.status === "approved").length,
      rejected: leaves.filter((x) => x.status === "rejected").length,
      cancelled: leaves.filter((x) => x.status === "cancelled").length,
    };
  }, [leaves]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiClient.post("/leaves", {
        ...formData,
        reason: formData.reason.trim(),
      });
      setFormData(defaultForm);
      await loadLeaves();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create leave request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: LeaveStatus) => {
    try {
      await apiClient.patch(`/leaves/${id}/status`, { status });
      await loadLeaves();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update leave status");
    }
  };

  const cancelLeave = async (id: string) => {
    try {
      await apiClient.patch(`/leaves/${id}/cancel`);
      await loadLeaves();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel leave request");
    }
  };

  const statusBadge = (status: LeaveStatus) => {
    const map: Record<LeaveStatus, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>
      )}

      {noProfileWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account does not have a linked employee profile yet. Please contact your administrator.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-2xl font-bold text-yellow-900">{leaveSummary.pending}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-4 border border-green-200">
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-2xl font-bold text-green-900">{leaveSummary.approved}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-700">Rejected</p>
          <p className="text-2xl font-bold text-red-900">{leaveSummary.rejected}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
          <p className="text-sm text-gray-700">Cancelled</p>
          <p className="text-2xl font-bold text-gray-900">{leaveSummary.cancelled}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-300 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Submit Leave Request</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isAdmin && (
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
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Leave Type</label>
              <select
                name="leaveType"
                value={formData.leaveType}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="casual">Casual</option>
                <option value="sick">Sick</option>
                <option value="earned">Earned</option>
                <option value="maternity">Maternity</option>
                <option value="paternity">Paternity</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                name="startDate"
                required
                value={formData.startDate}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                name="endDate"
                required
                value={formData.endDate}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea
              name="reason"
              rows={3}
              required
              value={formData.reason}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Date Range
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Days
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
                <td className="px-6 py-4 text-sm text-gray-500" colSpan={6}>
                  Loading leave requests...
                </td>
              </tr>
            ) : leaves.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-sm text-gray-500" colSpan={6}>
                  No leave requests found.
                </td>
              </tr>
            ) : (
              leaves.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.employee?.name || "Self"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{item.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(item.startDate).toLocaleDateString()} -{" "}
                    {new Date(item.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{item.days}</td>
                  <td className="px-6 py-4 text-sm">{statusBadge(item.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 space-x-2">
                    {isAdmin && item.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateStatus(item.id, "approved")}
                          className="text-green-700 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(item.id, "rejected")}
                          className="text-red-700 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {item.status === "pending" && (
                      <button
                        onClick={() => cancelLeave(item.id)}
                        className="text-gray-700 hover:text-gray-900"
                      >
                        Cancel
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

export default Leaves;
