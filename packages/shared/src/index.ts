// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  companyName: string;
}

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "super_admin" | "company_admin" | "employee";
  companyId: string;
  isActive: boolean;
  createdAt: string;
}

// Company types
export interface Company {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  subscriptionPlan: "free" | "pro" | "enterprise";
  subscriptionUntil?: string;
  isActive: boolean;
  createdAt: string;
}

// Employee types
export interface Employee {
  id: string;
  companyId: string;
  userId: string;
  employeeId: string;
  designation: string;
  salary?: number;
  joiningDate: string;
  status: "active" | "inactive" | "on_leave";
  createdAt: string;
}

// Error types
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: any
  ) {
    super(message);
  }
}
