import { describe, it, expect, beforeAll } from "vitest";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateTokens,
  extractTokenFromHeader,
} from "../utils/jwt";

const payload = {
  userId: "user-001",
  companyId: "company-001",
  email: "admin@demo.com",
  role: "company_admin",
};

describe("generateAccessToken", () => {
  it("returns a non-empty string", () => {
    const token = generateAccessToken(payload);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("produces a JWT with 3 parts", () => {
    const token = generateAccessToken(payload);
    expect(token.split(".").length).toBe(3);
  });
});

describe("generateRefreshToken", () => {
  it("returns a valid JWT string", () => {
    const token = generateRefreshToken(payload);
    expect(token.split(".").length).toBe(3);
  });
});

describe("verifyToken", () => {
  it("decodes a valid access token and returns payload fields", () => {
    const token = generateAccessToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(payload.userId);
    expect(decoded?.email).toBe(payload.email);
    expect(decoded?.role).toBe(payload.role);
    expect(decoded?.companyId).toBe(payload.companyId);
  });

  it("returns null for a tampered token", () => {
    const token = generateAccessToken(payload);
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(verifyToken(tampered)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifyToken("")).toBeNull();
  });

  it("returns null for a completely invalid token", () => {
    expect(verifyToken("not.a.jwt")).toBeNull();
  });
});

describe("generateTokens", () => {
  it("returns both accessToken and refreshToken", () => {
    const tokens = generateTokens(payload);
    expect(tokens).toHaveProperty("accessToken");
    expect(tokens).toHaveProperty("refreshToken");
    expect(typeof tokens.accessToken).toBe("string");
    expect(typeof tokens.refreshToken).toBe("string");
  });

  it("access and refresh tokens are different", () => {
    const tokens = generateTokens(payload);
    expect(tokens.accessToken).not.toBe(tokens.refreshToken);
  });
});

describe("extractTokenFromHeader", () => {
  it("extracts token from a valid Bearer header", () => {
    const token = generateAccessToken(payload);
    const result = extractTokenFromHeader(`Bearer ${token}`);
    expect(result).toBe(token);
  });

  it("returns null for missing header", () => {
    expect(extractTokenFromHeader(undefined)).toBeNull();
    expect(extractTokenFromHeader("")).toBeNull();
  });

  it("returns null when scheme is not Bearer", () => {
    const token = generateAccessToken(payload);
    expect(extractTokenFromHeader(`Basic ${token}`)).toBeNull();
  });

  it("returns null when header has wrong format", () => {
    expect(extractTokenFromHeader("BearerWithoutSpace")).toBeNull();
  });
});
