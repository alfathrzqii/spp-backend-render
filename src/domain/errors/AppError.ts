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
  constructor(message: string) {
    super(message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Permintaan tidak valid") {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Autentikasi gagal") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Akses ditolak") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Sumber daya tidak ditemukan") {
    super(message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Terjadi konflik data") {
    super(message);
  }
}

