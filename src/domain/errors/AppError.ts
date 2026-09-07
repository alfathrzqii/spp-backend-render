export class DomainError extends Error {
  public readonly isOperational: boolean;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AppError extends DomainError {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Permintaan tidak valid") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Autentikasi gagal") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Akses ditolak") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Sumber daya tidak ditemukan") {
    super(message, 404);
  }
}
