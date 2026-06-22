import { describe, it, expect } from "vitest";
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  CreateAttendanceSchema,
  UpdateAttendanceSchema,
  CreateLeaveSchema,
  UpdateLeaveSchema,
  CreatePayrollSchema,
} from "../utils/hr-validation";

// ─── Departments ─────────────────────────────────────────────────────────────

describe("CreateDepartmentSchema", () => {
  it("accepts valid department", () => {
    expect(
      CreateDepartmentSchema.safeParse({ name: "Engineering", description: "Dev team" }).success
    ).toBe(true);
  });

  it("accepts department without optional fields", () => {
    expect(CreateDepartmentSchema.safeParse({ name: "HR" }).success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    expect(CreateDepartmentSchema.safeParse({ name: "X" }).success).toBe(false);
  });
});

describe("UpdateDepartmentSchema", () => {
  it("accepts empty update (all optional)", () => {
    expect(UpdateDepartmentSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update", () => {
    expect(UpdateDepartmentSchema.safeParse({ name: "Finance" }).success).toBe(true);
  });
});

// ─── Employees ───────────────────────────────────────────────────────────────

const validEmployee = {
  userId: "user-001",
  employeeId: "EMP001",
  departmentId: "dept-001",
  designation: "Software Engineer",
  salary: 50000,
  joiningDate: "2024-01-15T00:00:00.000Z",
};

describe("CreateEmployeeSchema", () => {
  it("accepts valid employee data", () => {
    expect(CreateEmployeeSchema.safeParse(validEmployee).success).toBe(true);
  });

  it("rejects too-short employeeId", () => {
    expect(
      CreateEmployeeSchema.safeParse({ ...validEmployee, employeeId: "E1" }).success
    ).toBe(false);
  });

  it("rejects negative salary", () => {
    expect(
      CreateEmployeeSchema.safeParse({ ...validEmployee, salary: -100 }).success
    ).toBe(false);
  });

  it("rejects invalid joiningDate format", () => {
    expect(
      CreateEmployeeSchema.safeParse({ ...validEmployee, joiningDate: "not-a-date" }).success
    ).toBe(false);
  });
});

describe("UpdateEmployeeSchema", () => {
  it("accepts valid status values", () => {
    for (const status of ["active", "inactive", "on_leave"] as const) {
      expect(UpdateEmployeeSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(UpdateEmployeeSchema.safeParse({ status: "fired" }).success).toBe(false);
  });
});

// ─── Attendance ──────────────────────────────────────────────────────────────

const validAttendance = {
  employeeId: "emp-001",
  date: "2024-06-15",
  status: "present" as const,
};

describe("CreateAttendanceSchema", () => {
  it("accepts valid attendance record", () => {
    expect(CreateAttendanceSchema.safeParse(validAttendance).success).toBe(true);
  });

  it("accepts with check-in and check-out times", () => {
    expect(
      CreateAttendanceSchema.safeParse({
        ...validAttendance,
        checkInTime: "09:00:00",
        checkOutTime: "17:00:00",
      }).success
    ).toBe(true);
  });

  it("rejects invalid date", () => {
    expect(
      CreateAttendanceSchema.safeParse({ ...validAttendance, date: "15-06-2024" }).success
    ).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(
      CreateAttendanceSchema.safeParse({ ...validAttendance, status: "late" }).success
    ).toBe(false);
  });

  it("accepts all valid status values", () => {
    for (const status of ["present", "absent", "half_day", "leave"] as const) {
      expect(CreateAttendanceSchema.safeParse({ ...validAttendance, status }).success).toBe(true);
    }
  });
});

// ─── Leaves ──────────────────────────────────────────────────────────────────

const validLeave = {
  leaveType: "casual" as const,
  startDate: "2024-06-20",
  endDate: "2024-06-21",
  reason: "Personal work to attend",
};

describe("CreateLeaveSchema", () => {
  it("accepts valid leave request", () => {
    expect(CreateLeaveSchema.safeParse(validLeave).success).toBe(true);
  });

  it("rejects reason shorter than 5 characters", () => {
    expect(
      CreateLeaveSchema.safeParse({ ...validLeave, reason: "ok" }).success
    ).toBe(false);
  });

  it("rejects invalid leave type", () => {
    expect(
      CreateLeaveSchema.safeParse({ ...validLeave, leaveType: "vacation" }).success
    ).toBe(false);
  });

  it("accepts all valid leave types", () => {
    const types = ["casual", "sick", "earned", "maternity", "paternity", "unpaid", "other"] as const;
    for (const leaveType of types) {
      expect(CreateLeaveSchema.safeParse({ ...validLeave, leaveType }).success).toBe(true);
    }
  });
});

describe("UpdateLeaveSchema", () => {
  it("accepts valid status update", () => {
    expect(UpdateLeaveSchema.safeParse({ status: "approved" }).success).toBe(true);
    expect(UpdateLeaveSchema.safeParse({ status: "rejected" }).success).toBe(true);
  });

  it("accepts empty update (all optional)", () => {
    expect(UpdateLeaveSchema.safeParse({}).success).toBe(true);
  });
});

// ─── Payroll ─────────────────────────────────────────────────────────────────

describe("CreatePayrollSchema", () => {
  const validPayroll = {
    employeeId: "emp-001",
    month: "2024-06",
    baseSalary: 50000,
    bonuses: 5000,
    deductions: 1000,
    taxes: 2000,
  };

  it("accepts valid payroll data", () => {
    expect(CreatePayrollSchema.safeParse(validPayroll).success).toBe(true);
  });

  it("rejects invalid month format", () => {
    expect(
      CreatePayrollSchema.safeParse({ ...validPayroll, month: "06-2024" }).success
    ).toBe(false);
    expect(
      CreatePayrollSchema.safeParse({ ...validPayroll, month: "2024/06" }).success
    ).toBe(false);
  });

  it("rejects negative baseSalary", () => {
    expect(
      CreatePayrollSchema.safeParse({ ...validPayroll, baseSalary: -1 }).success
    ).toBe(false);
  });

  it("accepts payroll without optional salary fields", () => {
    expect(
      CreatePayrollSchema.safeParse({ employeeId: "emp-001", month: "2024-06" }).success
    ).toBe(true);
  });
});
