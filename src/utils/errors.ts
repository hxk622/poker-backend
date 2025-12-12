// 基础异常类
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;
  public timestamp: Date;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    this.timestamp = new Date();

    // 捕获堆栈跟踪
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 Bad Request
export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
  }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 401, details);
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 403, details);
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 404, details);
  }
}

// 409 Conflict
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, details);
  }
}

// 500 Internal Server Error
export class InternalServerError extends AppError {
  constructor(message: string = '服务器内部错误', details?: any) {
    super(message, 500, details);
  }
}

// 429 Too Many Requests
export class TooManyRequestsError extends AppError {
  constructor(message: string = '请求过于频繁', details?: any) {
    super(message, 429, details);
  }
}
