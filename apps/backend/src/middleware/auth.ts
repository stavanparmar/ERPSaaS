import { Request, Response, NextFunction } from "express";
import { extractTokenFromHeader, verifyToken, JwtPayload } from "../utils/jwt";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware - verifies JWT token from Authorization header
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
        message: "No token provided",
      });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
      return;
    }

    // Check tenant isolation - ensure requested company matches token
    const companyId = req.headers["x-company-id"] as string;
    if (companyId && companyId !== payload.companyId) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: "Company ID mismatch",
      });
      return;
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Token verification failed",
    });
  }
}

/**
 * Role-based access control middleware
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        statusCode: 401,
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        statusCode: 403,
        error: "Forbidden",
        message: `Only users with roles [${allowedRoles.join(", ")}] can access this resource`,
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware - doesn't fail if no token, but populates user if present
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    // Silently continue on error
    next();
  }
}
