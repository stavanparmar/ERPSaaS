import { z } from "zod";

// Department schemas
export const CreateDepartmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

export const UpdateDepartmentSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

// Employee schemas
export const CreateEmployeeSchema = z.object({
  userId: z.string().min(1, "Invalid user ID"),
  employeeId: z.string().min(3, "Employee ID must be at least 3 characters"),
  departmentId: z.string().min(1, "Invalid department ID"),
  designation: z.string().min(2, "Designation must be at least 2 characters"),
  salary: z.number().positive("Salary must be positive").optional(),
  joiningDate: z.string().datetime("Invalid date format"),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  manager: z.string().optional(),
});

export const UpdateEmployeeSchema = z.object({
  employeeId: z.string().min(3).optional(),
  departmentId: z.string().min(1).optional(),
  designation: z.string().min(2).optional(),
  salary: z.number().positive().optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  manager: z.string().optional(),
  status: z.enum(["active", "inactive", "on_leave"]).optional(),
});

// Attendance schemas
export const CreateAttendanceSchema = z.object({
  employeeId: z.string().min(1, "Invalid employee ID"),
  date: z.string().date("Invalid date format"),
  checkInTime: z.string().time().optional(),
  checkOutTime: z.string().time().optional(),
  status: z.enum(["present", "absent", "half_day", "leave"]),
  notes: z.string().optional(),
});

export const UpdateAttendanceSchema = z.object({
  checkInTime: z.string().time().optional(),
  checkOutTime: z.string().time().optional(),
  status: z.enum(["present", "absent", "half_day", "leave"]).optional(),
  notes: z.string().optional(),
});

// Leave schemas
export const CreateLeaveSchema = z.object({
  employeeId: z.string().min(1, "Invalid employee ID").optional(),
  leaveType: z.enum(["casual", "sick", "earned", "maternity", "paternity", "unpaid", "other"]),
  startDate: z.string().date("Invalid date format"),
  endDate: z.string().date("Invalid date format"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
});

export const UpdateLeaveSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  reason: z.string().min(5).optional(),
});

// Payroll schemas
export const CreatePayrollSchema = z.object({
  employeeId: z.string().min(1, "Invalid employee ID"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  baseSalary: z.number().positive().optional(),
  bonuses: z.number().min(0).optional(),
  deductions: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const UpdatePayrollSchema = z.object({
  baseSalary: z.number().positive().optional(),
  bonuses: z.number().min(0).optional(),
  deductions: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "approved", "paid", "cancelled"]).optional(),
});

// Type exports
export type CreateDepartmentRequest = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentRequest = z.infer<typeof UpdateDepartmentSchema>;
export type CreateEmployeeRequest = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeRequest = z.infer<typeof UpdateEmployeeSchema>;
export type CreateAttendanceRequest = z.infer<typeof CreateAttendanceSchema>;
export type UpdateAttendanceRequest = z.infer<typeof UpdateAttendanceSchema>;
export type CreateLeaveRequest = z.infer<typeof CreateLeaveSchema>;
export type UpdateLeaveRequest = z.infer<typeof UpdateLeaveSchema>;
export type CreatePayrollRequest = z.infer<typeof CreatePayrollSchema>;
export type UpdatePayrollRequest = z.infer<typeof UpdatePayrollSchema>;
