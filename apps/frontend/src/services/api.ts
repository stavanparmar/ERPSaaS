import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export interface ApiResponse<T = any> {
  statusCode: number;
  data?: T;
  message?: string;
  error?: string;
}

let authContextRef: any = null;

/**
 * Set the auth context reference for the API client
 * This is called from the auth context to enable token refresh
 */
export function setAuthContext(context: any) {
  authContextRef = context;
}

/**
 * Create API client instance with interceptors
 */
export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor: Add authorization token
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add company ID header if available
      const user = localStorage.getItem("user");
      if (user) {
        try {
          const userData = JSON.parse(user);
          if (userData.companyId) {
            config.headers["x-company-id"] = userData.companyId;
          }
        } catch (error) {
          console.error("Failed to parse user data:", error);
        }
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor: Handle token refresh and errors
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      // If we get a 401 and haven't already tried to refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem("refreshToken");
          if (!refreshToken || !authContextRef) {
            throw new Error("No refresh token available");
          }

          // Call refresh endpoint
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const newAccessToken = response.data.data.accessToken;
          localStorage.setItem("accessToken", newAccessToken);

          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          // Retry the original request
          return client(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          if (authContextRef?.logout) {
            authContextRef.logout();
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

// Export singleton instance
export const apiClient = createApiClient();

/**
 * Generic API call wrapper with error handling
 */
export async function apiCall<T = any>(
  method: "get" | "post" | "patch" | "put" | "delete",
  url: string,
  data?: any,
  config?: any
): Promise<T> {
  try {
    const response = await apiClient[method](url, data, config);
    return response.data.data || response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiResponse;
      throw new Error(apiError?.message || error.message);
    }
    throw error;
  }
}
