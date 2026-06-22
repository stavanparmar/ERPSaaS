import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/api";

interface Department {
  id: string;
  name: string;
  description?: string;
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  employeeCount: number;
  createdAt: string;
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

const Departments = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { user } = useAuth();

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await apiClient.get("/departments");
      setDepartments(response.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load departments"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      await apiClient.post("/departments", formData);
      setFormData({
        name: "",
        description: "",
      });
      setShowCreateForm(false);
      await loadDepartments();
    } catch (err) {
      setCreateError(getApiErrorMessage(err, "Failed to create department"));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!window.confirm("Are you sure you want to delete this department?")) {
      return;
    }

    try {
      await apiClient.delete(`/departments/${departmentId}`);
      await loadDepartments();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to delete department"));
    }
  };

  // Only admins can manage departments
  if (user?.role === "employee") {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <div className="text-sm font-medium text-red-800">
          You don't have permission to access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
        >
          {showCreateForm ? "Cancel" : "Add Department"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm font-medium text-red-800">{error}</div>
        </div>
      )}

      {showCreateForm && (
        <div className="rounded-lg border border-gray-300 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Department</h2>

          {createError && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <div className="text-sm font-medium text-red-800">{createError}</div>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Department Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleCreateChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                disabled={createLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleCreateChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                disabled={createLoading}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 text-sm font-medium"
              >
                {createLoading ? "Creating..." : "Create Department"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Loading departments...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {departments.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500">
              No departments found
            </div>
          ) : (
            departments.map((dept) => (
              <div key={dept.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow">
                <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                {dept.description && (
                  <p className="mt-2 text-sm text-gray-600">{dept.description}</p>
                )}
                <div className="mt-4 space-y-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{dept.employeeCount}</span>{" "}
                    employees
                  </div>
                  {dept.manager && (
                    <div className="text-sm text-gray-600">
                      Manager: <span className="font-medium">{dept.manager.name}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteDepartment(dept.id)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Departments;
