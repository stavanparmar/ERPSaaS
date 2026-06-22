/**
 * Tests for frontend routing utilities and page-level access control logic.
 */
import { describe, it, expect } from "vitest";

// ─── Role-based access helpers (mirrors Layout & page logic) ─────────────────

type Role = "super_admin" | "company_admin" | "employee";

function isAdmin(role: Role): boolean {
  return role === "company_admin" || role === "super_admin";
}

function getVisibleNavItems(role: Role) {
  const adminOnly = ["users", "departments", "employees"];
  const all = ["dashboard", "attendance", "leaves", "payroll", "inventory", "sales", "accounting", "purchases"];

  return isAdmin(role) ? [...adminOnly, ...all] : all;
}

function canAccessPage(page: string, role: Role): boolean {
  const adminOnlyPages = ["users", "departments", "employees"];
  if (adminOnlyPages.includes(page)) return isAdmin(role);
  return true;
}

describe("isAdmin", () => {
  it("returns true for company_admin", () => {
    expect(isAdmin("company_admin")).toBe(true);
  });

  it("returns true for super_admin", () => {
    expect(isAdmin("super_admin")).toBe(true);
  });

  it("returns false for employee", () => {
    expect(isAdmin("employee")).toBe(false);
  });
});

describe("getVisibleNavItems", () => {
  it("shows admin-only items for company_admin", () => {
    const items = getVisibleNavItems("company_admin");
    expect(items).toContain("users");
    expect(items).toContain("departments");
    expect(items).toContain("employees");
  });

  it("hides admin-only items for employee", () => {
    const items = getVisibleNavItems("employee");
    expect(items).not.toContain("users");
    expect(items).not.toContain("departments");
    expect(items).not.toContain("employees");
  });

  it("always shows common pages for all roles", () => {
    for (const role of ["super_admin", "company_admin", "employee"] as Role[]) {
      const items = getVisibleNavItems(role);
      expect(items).toContain("dashboard");
      expect(items).toContain("attendance");
      expect(items).toContain("leaves");
      expect(items).toContain("payroll");
    }
  });
});

describe("canAccessPage", () => {
  it("allows employee to access attendance, leaves, payroll", () => {
    expect(canAccessPage("attendance", "employee")).toBe(true);
    expect(canAccessPage("leaves", "employee")).toBe(true);
    expect(canAccessPage("payroll", "employee")).toBe(true);
    expect(canAccessPage("dashboard", "employee")).toBe(true);
  });

  it("blocks employee from admin pages", () => {
    expect(canAccessPage("users", "employee")).toBe(false);
    expect(canAccessPage("departments", "employee")).toBe(false);
    expect(canAccessPage("employees", "employee")).toBe(false);
  });

  it("allows admin to access all pages", () => {
    for (const page of ["users", "departments", "employees", "dashboard", "leaves"]) {
      expect(canAccessPage(page, "company_admin")).toBe(true);
    }
  });
});

// ─── Page title resolver (mirrors Layout's getPageTitle) ─────────────────────

function getPageTitle(pathname: string): string {
  if (pathname.includes("users")) return "User Management";
  if (pathname.includes("departments")) return "Departments";
  if (pathname.includes("employees")) return "Employees";
  if (pathname.includes("attendance")) return "Attendance";
  if (pathname.includes("leaves")) return "Leave Management";
  if (pathname.includes("payroll")) return "Payroll";
  if (pathname.includes("inventory")) return "Inventory";
  if (pathname.includes("sales")) return "Sales";
  if (pathname.includes("accounting")) return "Accounting";
  if (pathname.includes("purchases")) return "Purchases";
  return "Dashboard";
}

describe("getPageTitle", () => {
  it("returns correct title for each route", () => {
    expect(getPageTitle("/users")).toBe("User Management");
    expect(getPageTitle("/departments")).toBe("Departments");
    expect(getPageTitle("/employees")).toBe("Employees");
    expect(getPageTitle("/attendance")).toBe("Attendance");
    expect(getPageTitle("/leaves")).toBe("Leave Management");
    expect(getPageTitle("/payroll")).toBe("Payroll");
    expect(getPageTitle("/inventory")).toBe("Inventory");
    expect(getPageTitle("/sales")).toBe("Sales");
    expect(getPageTitle("/accounting")).toBe("Accounting");
    expect(getPageTitle("/purchases")).toBe("Purchases");
  });

  it("returns Dashboard as default", () => {
    expect(getPageTitle("/dashboard")).toBe("Dashboard");
    expect(getPageTitle("/")).toBe("Dashboard");
    expect(getPageTitle("/unknown")).toBe("Dashboard");
  });
});
