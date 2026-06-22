import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  generateTokens,
  verifyToken,
  generateAccessToken,
  JwtPayload,
} from "../utils/jwt";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  validatePasswordStrength,
} from "../utils/validation";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/v1/auth/register
 * Register a new company and admin user
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validationResult = RegisterRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        statusCode: 400,
        error: "Validation Error",
        message: validationResult.error.errors[0].message,
      });
      return;
    }

    const { email, firstName, lastName, password, companyName } =
      validationResult.data;

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

    // Create company
    const company = await prisma.company.create({
      data: {
        name: companyName,
        email,
        subscriptionPlan: "pro",
        subscriptionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        isActive: true,
      },
    });

    // Get company_admin role
    const adminRole = await prisma.role.findUnique({
      where: {
        name: "company_admin",
      },
    });

    if (!adminRole) {
      throw new Error("Company admin role not found");
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword,
        companyId: company.id,
        roleId: adminRole.id,
        isActive: true,
        isEmailVerified: true, // Auto-verify on registration
      },
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      companyId: company.id,
      email: user.email,
      role: adminRole.name,
    });

    res.status(201).json({
      statusCode: 201,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: adminRole.name,
          companyId: company.id,
        },
      },
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Registration failed",
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user and return JWT tokens
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validationResult = LoginRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        statusCode: 400,
        error: "Validation Error",
        message: validationResult.error.errors[0].message,
      });
      return;
    }

    const { email, password } = validationResult.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid email or password",
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid email or password",
      });
      return;
    }

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role.name,
    });

    res.status(200).json({
      statusCode: 200,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.name,
          companyId: user.companyId,
        },
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Login failed",
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        statusCode: 400,
        error: "Bad Request",
        message: "Refresh token is required",
      });
      return;
    }

    // Verify refresh token
    const payload = verifyToken(refreshToken);
    if (!payload) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid or expired refresh token",
      });
      return;
    }

    // Fetch user to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
        message: "User not found or inactive",
      });
      return;
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role.name,
    });

    res.status(200).json({
      statusCode: 200,
      data: {
        accessToken: newAccessToken,
      },
      message: "Token refreshed successfully",
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Token refresh failed",
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user (client-side token deletion handled on frontend)
 */
router.post(
  "/logout",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    // In a real app, you might invalidate the token on the server
    // For now, we just acknowledge the logout request
    res.status(200).json({
      statusCode: 200,
      message: "Logout successful",
    });
  }
);

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get(
  "/me",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          statusCode: 401,
          error: "Unauthorized",
          message: "User not authenticated",
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          roleId: true,
          companyId: true,
          isActive: true,
          createdAt: true,
          role: true,
        },
      });

      if (!user) {
        res.status(404).json({
          statusCode: 404,
          error: "Not Found",
          message: "User not found",
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
          companyId: user.companyId,
          isActive: user.isActive,
        },
        message: "User info retrieved",
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to get user info",
      });
    }
  }
);

export default router;
