import type { Request, Response, NextFunction } from "express";
import {
  DomainError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../../../domain/errors/AppError.js";
import { logger } from "../../services/WinstonLogger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = err.message || "Internal Server Error";

  if (err instanceof BadRequestError) {
    statusCode = 400;
  } else if (err instanceof UnauthorizedError) {
    statusCode = 401;
  } else if (err instanceof ForbiddenError) {
    statusCode = 403;
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
  } else if (err instanceof ConflictError) {
    statusCode = 409;
  } else if (err instanceof DomainError) {
    statusCode = 400;
  } else if (err.statusCode && typeof err.statusCode === "number") {
    // Backward compatibility for external/framework errors
    statusCode = err.statusCode;
  }

  if (statusCode >= 500) {
    logger.error(err.message, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

