import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api";

interface Employee {
  id: string;
  employeeId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  designation: string;
  department: {
    id: string;
    name: string;
  };
  salary?: number;
  joiningDate: string;
  status: "active" | "inactive" | "on_leave";
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

interface CompanyUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const responseData = err.response?.data as
      | { message?: string; error?: string }
      | undefined;
    return responseData?.message || responseData?.error || err.message || fallback;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [formData, setFormData] = useState({
    userId: "",
    employeeId: "",
    designation: "",
    departmentId: "",
    salary: "",
    phoneNumber: "",
    address: "",
    manager: "",
    joiningDate: new Date().toISOString().split("T")[0],
  });

  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [filterDept]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Load departments
      try {
        const deptResponse = await apiClient.get("/departments");
        setDepartments(deptResponse.data.data);
      } catch (err) {
        // Departments might not be available
      }

      // Load employees
      const empUrl = filterDept ? `/employees?departmentId=${filterDept}` : "/employees";
      const empResponse = await apiClient.get(empUrl);
      const loadedEmployees: Employee[] = empResponse.data.data || [];
      setEmployees(loadedEmployees);

      // Load users and keep only employee-role users not yet linked as employees.
      const usersResponse = await apiClient.get("/users");
      const companyUsers: CompanyUser[] = usersResponse.data.data || [];
      const assignedUserIds = new Set(loadedEmployees.map((employee) => employee.user.id));

      setAssignableUsers(
        companyUsers.filter(
          (companyUser) =>
            companyUser.isActive &&
            companyUser.role === "employee" &&
            !assignedUserIds.has(companyUser.id)
        )
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load data"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      const payload: Record<string, string | number> = {
        userId: formData.userId,
        employeeId: formData.employeeId,
        designation: formData.designation,
        departmentId: formData.departmentId,
        joiningDate: new Date(formData.joiningDate).toISOString(),
      };

      if (formData.salary) {
        payload.salary = Number(formData.salary);
      }
      if (formData.phoneNumber) {
        payload.phoneNumber = formData.phoneNumber;
      }
      if (formData.address) {
        payload.address = formData.address;
      }
      if (formData.manager) {
        payload.manager = formData.manager;
      }

      await apiClient.post("/employees", payload);

      setFormData({
        userId: "",
        employeeId: "",
        designation: "",
        departmentId: "",
        salary: "",
        phoneNumber: "",
        address: "",
        manager: "",
        joiningDate: new Date().toISOString().split("T")[0],
      });
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      setCreateError(getApiErrorMessage(err, "Failed to create employee"));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) {
      return;
    }

    try {
      await apiClient.delete(`/employees/${employeeId}`);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to delete employee"));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "on_leave":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Only admins can manage employees
  if (user?.role === "employee") {
    return (
      <div className="rounded-lg bg-blue-50 p-4">
        <div className="text-sm font-medium text-blue-800">
          Employee information is visible only to managers and administrators.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
        >
          {showCreateForm ? "Cancel" : "Add Employee"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm font-medium text-red-800">{error}</div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Department
          </label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-lg border border-gray-300 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Add New Employee</h2>

          {createError && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <div className="text-sm font-medium text-red-800">{createError}</div>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">User</label>
              <select
                name="userId"
                required
                value={formData.userId}
                onChange={handleCreateChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                disabled={createLoading}
              >
                <option value="">Select User</option>
                {assignableUsers.map((assignableUser) => (
                  <option key={assignableUser.id} value={assignableUser.id}>
                    {assignableUser.firstName} {assignableUser.lastName} ({assignableUser.email})
                  </option>
                ))}
              </select>
              {assignableUsers.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No available employee users. Create users from User Management first.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Employee ID
                </label>
                <input
                  type="text"
                  name="employeeId"
                  required
                  value={formData.employeeId}
                  onChange={handleCreateChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  disabled={createLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Designation
                </label>
                <input
                  type="text"
                  name="designation"
                  required
                  value={formData.designation}
                  onChange={handleCreateChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  disabled={createLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <select
                  name="departmentId"
                  required
                  value={formData.departmentId}
                  onChange={handleCreateChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  disabled={createLoading}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Salary
                </label>
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleCreateChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  disabled={createLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Joining Date
              </label>
              <input
                type="date"
                name="joiningDate"
                required
                value={formData.joiningDate}
                onChange={handleCreateChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                disabled={createLoading}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number (optional)
                </label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleCreateChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  disabled={createLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Manager (optional)
                </label>
                <input
                  type="text"
                  name="manager"
                  value={formData.manager}
                  onChange={handleCreateChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  disabled={createLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address (optional)
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleCreateChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                disabled={createLoading}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createLoading || assignableUsers.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 text-sm font-medium"
              >
                {createLoading ? "Adding..." : "Add Employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Loading employees...</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {emp.employeeId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {emp.user.firstName} {emp.user.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {emp.designation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {emp.department.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(emp.status)}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                      <button className="text-indigo-600 hover:text-indigo-900">
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Employees;
