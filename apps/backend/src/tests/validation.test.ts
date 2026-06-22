import { describe, it, expect } from "vitest";
import {
  validatePasswordStrength,
  LoginRequestSchema,
  RegisterRequestSchema,
  CreateUserSchema,
  UpdateUserSchema,
} from "../utils/validation";

describe("validatePasswordStrength", () => {
  it("passes for a strong password", () => {
    const result = validatePasswordStrength("Secure@123");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when password is too short", () => {
    const result = validatePasswordStrength("S@1");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Password must be at least 8 characters");
  });

  it("fails when missing uppercase letter", () => {
    const result = validatePasswordStrength("secure@123");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one uppercase letter");
  });

  it("fails when missing lowercase letter", () => {
    const result = validatePasswordStrength("SECURE@123");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one lowercase letter");
  });

  it("fails when missing number", () => {
    const result = validatePasswordStrength("Secure@abc");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one number");
  });

  it("fails when missing special character", () => {
    const result = validatePasswordStrength("Secure1234");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one special character (!@#$%^&*)"
    );
  });

  it("collects multiple errors at once", () => {
    const result = validatePasswordStrength("weak");
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe("LoginRequestSchema", () => {
  it("accepts valid login credentials", () => {
    const result = LoginRequestSchema.safeParse({
      email: "admin@demo.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = LoginRequestSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = LoginRequestSchema.safeParse({
      email: "admin@demo.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = LoginRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("RegisterRequestSchema", () => {
  const valid = {
    email: "admin@company.com",
    firstName: "John",
    lastName: "Doe",
    password: "Secure@123",
    companyName: "Acme Corp",
  };

  it("accepts valid registration data", () => {
    expect(RegisterRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects too-short first name", () => {
    expect(
      RegisterRequestSchema.safeParse({ ...valid, firstName: "J" }).success
    ).toBe(false);
  });

  it("rejects too-short company name", () => {
    expect(
      RegisterRequestSchema.safeParse({ ...valid, companyName: "A" }).success
    ).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(
      RegisterRequestSchema.safeParse({ ...valid, email: "not-valid" }).success
    ).toBe(false);
  });
});

describe("CreateUserSchema", () => {
  const valid = {
    email: "user@company.com",
    firstName: "Jane",
    lastName: "Smith",
    password: "Secure@123",
    role: "employee" as const,
  };

  it("accepts valid user creation data", () => {
    expect(CreateUserSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all valid roles", () => {
    for (const role of ["super_admin", "company_admin", "employee"] as const) {
      expect(CreateUserSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    expect(
      CreateUserSchema.safeParse({ ...valid, role: "manager" }).success
    ).toBe(false);
  });
});

describe("UpdateUserSchema", () => {
  it("accepts partial updates", () => {
    expect(UpdateUserSchema.safeParse({ firstName: "NewName" }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ email: "new@email.com" }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({}).success).toBe(true);
  });

  it("rejects bad email in update", () => {
    expect(UpdateUserSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});
