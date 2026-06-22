import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "super_admin" | "company_admin" | "employee";
  companyId: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    companyName: string
  ) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  refreshAccessToken: (refreshToken: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function parseJsonResponse(response: Response): Promise<any | null> {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Server returned an invalid JSON response");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");

    if (storedUser && storedAccessToken) {
      try {
        setUser(JSON.parse(storedUser));
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
      } catch (error) {
        console.error("Failed to parse stored auth data:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.message || "Login failed");
      }

      if (!data?.data) {
        throw new Error("Login response is missing required data");
      }

      setUser(data.data.user);
      setAccessToken(data.data.accessToken);
      setRefreshToken(data.data.refreshToken);

      // Store in localStorage
      localStorage.setItem("user", JSON.stringify(data.data.user));
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
    } catch (error) {
      throw error;
    }
  };

  const register = async (
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    companyName: string
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          password,
          companyName,
        }),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.message || "Registration failed");
      }

      if (!data?.data) {
        throw new Error("Registration response is missing required data");
      }

      setUser(data.data.user);
      setAccessToken(data.data.accessToken);
      setRefreshToken(data.data.refreshToken);

      // Store in localStorage
      localStorage.setItem("user", JSON.stringify(data.data.user));
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  const refreshAccessToken = async (refreshTok: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: refreshTok }),
      });

      if (!response.ok) {
        logout();
        throw new Error("Token refresh failed");
      }

      const data = await parseJsonResponse(response);
      if (!data?.data?.accessToken) {
        logout();
        throw new Error("Token refresh response is missing access token");
      }

      setAccessToken(data.data.accessToken);
      localStorage.setItem("accessToken", data.data.accessToken);

      return data.data.accessToken;
    } catch (error) {
      logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    accessToken,
    refreshToken,
    isLoading,
    login,
    register,
    logout,
    setUser,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
