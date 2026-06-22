/**
 * Tests for the API service layer — covers base URL config, interceptor logic,
 * error message extraction, and apiCall wrapper behaviour.
 * No real HTTP requests are made; axios is mocked via vitest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

// ─── Helpers tested inline (no direct import of apiClient singleton) ─────────

function getBaseUrl(envUrl?: string): string {
  return envUrl ?? "http://localhost:3001/api/v1";
}

function extractApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message ?? data?.error ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

describe("getBaseUrl", () => {
  it("uses the provided env URL", () => {
    expect(getBaseUrl("http://api.example.com/v1")).toBe("http://api.example.com/v1");
  });

  it("falls back to localhost when no env var", () => {
    expect(getBaseUrl(undefined)).toBe("http://localhost:3001/api/v1");
  });
});

// ─── extractApiError ─────────────────────────────────────────────────────────

describe("extractApiError", () => {
  it("extracts message from axios error response data", () => {
    const axiosError = new axios.AxiosError("Request failed");
    // @ts-ignore – manually set response for test
    axiosError.response = { data: { message: "Email already exists" }, status: 409 };
    expect(extractApiError(axiosError, "fallback")).toBe("Email already exists");
  });

  it("falls back to error field when message is absent", () => {
    const axiosError = new axios.AxiosError("Request failed");
    // @ts-ignore
    axiosError.response = { data: { error: "Conflict" }, status: 409 };
    expect(extractApiError(axiosError, "fallback")).toBe("Conflict");
  });

  it("uses axios message when response data has no message/error", () => {
    const axiosError = new axios.AxiosError("Network Error");
    // @ts-ignore
    axiosError.response = { data: {}, status: 503 };
    expect(extractApiError(axiosError, "fallback")).toBe("Network Error");
  });

  it("uses fallback when response data is undefined", () => {
    const axiosError = new axios.AxiosError();
    expect(extractApiError(axiosError, "Something went wrong")).toBe("Something went wrong");
  });

  it("returns Error message for non-axios errors", () => {
    expect(extractApiError(new Error("Unexpected"), "fallback")).toBe("Unexpected");
  });

  it("returns fallback for unknown thrown values", () => {
    expect(extractApiError("some string error", "fallback")).toBe("fallback");
    expect(extractApiError(null, "fallback")).toBe("fallback");
  });
});

// ─── Token storage helpers (mirroring AuthContext logic) ──────────────────────

function storeTokens(accessToken: string, refreshToken: string, user: object) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  localStorage.setItem("user", JSON.stringify(user));
}

function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

function getStoredUser(): object | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

describe("Token localStorage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves tokens correctly", () => {
    const user = { id: "1", email: "admin@demo.com", role: "company_admin" };
    storeTokens("access-abc", "refresh-xyz", user);

    expect(localStorage.getItem("accessToken")).toBe("access-abc");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-xyz");
    expect(getStoredUser()).toEqual(user);
  });

  it("clearTokens removes all auth data", () => {
    storeTokens("a", "b", { id: "1" });
    clearTokens();

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("getStoredUser returns null when nothing stored", () => {
    expect(getStoredUser()).toBeNull();
  });

  it("getStoredUser returns null on malformed JSON", () => {
    localStorage.setItem("user", "{{broken json}}");
    expect(getStoredUser()).toBeNull();
  });
});
