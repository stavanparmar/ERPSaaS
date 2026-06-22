import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, authorize } from "../middleware/auth";
import {
  UpdateUserSchema,
  CreateUserSchema,
  validatePasswordStrength,
} from "../utils/validation";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/users
 * Get all users in the company (company_admin and super_admin only)
 */
router.get(
  "/",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const users = await prisma.user.findMany({
        where: {
          companyId: req.user.companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: {
            select: {
              name: true,
            },
          },
          isActive: true,
          createdAt: true,
        },
      });

      res.status(200).json({
        statusCode: 200,
        data: users.map((user: any) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.name,
          isActive: user.isActive,
          createdAt: user.createdAt,
        })),
        message: "Users retrieved successfully",
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get users",
      });
    }
  }
);

/**
 * GET /api/v1/users/:id
 * Get a specific user
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: { role: true },
      });

      if (!user || user.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "User not found",
        });
        return;
      }

      // Users can only view themselves or admins can view company users
      if (
        req.user.userId !== user.id &&
        req.user.role !== "company_admin" &&
        req.user.role !== "super_admin"
      ) {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "You don't have permission to view this user",
        });
        return;
      }

      // Ensure same company
      if (user.companyId !== req.user.companyId && req.user.role !== "super_admin") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "User belongs to different company",
        });
        return;
      }

      res.status(200).json({
        statusCode: 200,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.name,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        message: "User retrieved successfully",
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get user",
      });
    }
  }
);

/**
 * POST /api/v1/users
 * Create a new user (company_admin and super_admin only)
 */
router.post(
  "/",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      // Validate input
      const validationResult = CreateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { email, firstName, lastName, password, role } = validationResult.data;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(409).json({
          statusCode: 409,
          error: "Conflict",
          message: "User with this email already exists",
        });
        return;
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: "Password does not meet security requirements",
          data: { errors: passwordValidation.errors },
        });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Get role
      const userRole = await prisma.role.findUnique({
        where: {
          name: role,
        },
      });

      if (!userRole) {
        res.status(400).json({
          statusCode: 400,
          error: "Bad Request",
          message: `Role ${role} not found`,
        });
        return;
      }

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          password: hashedPassword,
          companyId: req.user.companyId,
          roleId: userRole.id,
          isActive: true,
          isEmailVerified: false,
        },
        include: { role: true },
      });

      res.status(201).json({
        statusCode: 201,
        data: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role.name,
          isActive: newUser.isActive,
        },
        message: "User created successfully",
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to create user",
      });
    }
  }
);

/**
 * PATCH /api/v1/users/:id
 * Update user information
 */
router.patch(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const { id } = req.params;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user || user.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "User not found",
        });
        return;
      }

      // Users can only update themselves or admins can update company users
      if (
        req.user.userId !== id &&
        req.user.role !== "company_admin" &&
        req.user.role !== "super_admin"
      ) {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "You don't have permission to update this user",
        });
        return;
      }

      // Ensure same company
      if (user.companyId !== req.user.companyId && req.user.role !== "super_admin") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "User belongs to different company",
        });
        return;
      }

      // Validate input
      const validationResult = UpdateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          statusCode: 400,
          error: "Validation Error",
          message: validationResult.error.errors[0].message,
        });
        return;
      }

      const { firstName, lastName, email } = validationResult.data;

      // Check if new email is already used by another user
      if (email && email !== user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });
        if (existingUser) {
          res.status(409).json({
            statusCode: 409,
            error: "Conflict",
            message: "Email already in use",
          });
          return;
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(email && { email }),
        },
        include: { role: true },
      });

      res.status(200).json({
        statusCode: 200,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role.name,
          isActive: updatedUser.isActive,
        },
        message: "User updated successfully",
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to update user",
      });
    }
  }
);

/**
 * DELETE /api/v1/users/:id
 * Soft delete user
 */
router.delete(
  "/:id",
  authenticateToken,
  authorize("company_admin", "super_admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
        });
        return;
      }

      const { id } = req.params;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user || user.deletedAt) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "User not found",
        });
        return;
      }

      // Ensure same company
      if (user.companyId !== req.user.companyId && req.user.role !== "super_admin") {
        res.status(403).json({
          statusCode: 403,
          error: "Forbidden",
          message: "User belongs to different company",
        });
        return;
      }

      // Cannot delete yourself
      if (req.user.userId === id) {
        res.status(400).json({
          statusCode: 400,
          error: "Bad Request",
          message: "Cannot delete your own account",
        });
        return;
      }

      // Soft delete user
      await prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      res.status(200).json({
        statusCode: 200,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to delete user",
      });
    }
  }
);

export default router;
