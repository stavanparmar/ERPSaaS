/**
 * Tests for form/data validation logic used across frontend pages.
 */
import { describe, it, expect } from "vitest";

// ─── Attendance form helpers ──────────────────────────────────────────────────

function getAttendanceStatusColor(status: string): string {
  switch (status) {
    case "present": return "bg-green-100 text-green-800";
    case "absent": return "bg-red-100 text-red-800";
    case "half_day": return "bg-yellow-100 text-yellow-800";
    case "leave": return "bg-blue-100 text-blue-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

describe("getAttendanceStatusColor", () => {
  it("returns green for present", () => {
    expect(getAttendanceStatusColor("present")).toContain("green");
  });
  it("returns red for absent", () => {
    expect(getAttendanceStatusColor("absent")).toContain("red");
  });
  it("returns yellow for half_day", () => {
    expect(getAttendanceStatusColor("half_day")).toContain("yellow");
  });
  it("returns blue for leave", () => {
    expect(getAttendanceStatusColor("leave")).toContain("blue");
  });
  it("returns gray for unknown status", () => {
    expect(getAttendanceStatusColor("unknown")).toContain("gray");
  });
});

// ─── Employee status color ────────────────────────────────────────────────────

function getEmployeeStatusColor(status: string): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-800";
    case "inactive": return "bg-red-100 text-red-800";
    case "on_leave": return "bg-yellow-100 text-yellow-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

describe("getEmployeeStatusColor", () => {
  it("returns correct color for each status", () => {
    expect(getEmployeeStatusColor("active")).toContain("green");
    expect(getEmployeeStatusColor("inactive")).toContain("red");
    expect(getEmployeeStatusColor("on_leave")).toContain("yellow");
    expect(getEmployeeStatusColor("terminated")).toContain("gray");
  });
});

// ─── Leave summary aggregation ────────────────────────────────────────────────

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

interface LeaveItem {
  id: string;
  status: LeaveStatus;
}

function computeLeaveSummary(leaves: LeaveItem[]) {
  return {
    pending: leaves.filter((x) => x.status === "pending").length,
    approved: leaves.filter((x) => x.status === "approved").length,
    rejected: leaves.filter((x) => x.status === "rejected").length,
    cancelled: leaves.filter((x) => x.status === "cancelled").length,
  };
}

describe("computeLeaveSummary", () => {
  const leaves: LeaveItem[] = [
    { id: "1", status: "pending" },
    { id: "2", status: "pending" },
    { id: "3", status: "approved" },
    { id: "4", status: "rejected" },
    { id: "5", status: "cancelled" },
  ];

  it("counts pending correctly", () => {
    expect(computeLeaveSummary(leaves).pending).toBe(2);
  });

  it("counts approved correctly", () => {
    expect(computeLeaveSummary(leaves).approved).toBe(1);
  });

  it("counts rejected correctly", () => {
    expect(computeLeaveSummary(leaves).rejected).toBe(1);
  });

  it("counts cancelled correctly", () => {
    expect(computeLeaveSummary(leaves).cancelled).toBe(1);
  });

  it("returns all zeros for empty list", () => {
    const summary = computeLeaveSummary([]);
    expect(summary.pending).toBe(0);
    expect(summary.approved).toBe(0);
  });
});

// ─── Payroll net salary calculation ──────────────────────────────────────────

function computeNetSalary(
  base: number,
  bonuses: number,
  deductions: number,
  taxes: number
): number {
  return base + bonuses - deductions - taxes;
}

describe("computeNetSalary", () => {
  it("calculates correctly with all fields", () => {
    expect(computeNetSalary(50000, 5000, 1000, 2000)).toBe(52000);
  });

  it("returns base salary when all extras are zero", () => {
    expect(computeNetSalary(50000, 0, 0, 0)).toBe(50000);
  });

  it("can result in zero if deductions cancel salary", () => {
    expect(computeNetSalary(50000, 0, 50000, 0)).toBe(0);
  });
});

// ─── Date formatting (used in tables) ────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    const result = formatDate("2024-06-15T00:00:00.000Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2024/);
  });

  it("handles date-only strings", () => {
    const result = formatDate("2024-01-01");
    expect(result).toMatch(/Jan/);
  });
});

// ─── Role badge label ─────────────────────────────────────────────────────────

function formatRoleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

describe("formatRoleLabel", () => {
  it("formats company_admin correctly", () => {
    expect(formatRoleLabel("company_admin")).toBe("company admin");
  });

  it("formats super_admin correctly", () => {
    expect(formatRoleLabel("super_admin")).toBe("super admin");
  });

  it("leaves employee unchanged", () => {
    expect(formatRoleLabel("employee")).toBe("employee");
  });
});
