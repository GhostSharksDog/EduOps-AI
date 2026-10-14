import { AppException } from '@/shared/errors/base.exception';
import type { ErrorCode } from '@/shared/errors/error-codes';
import { getErrorMessage } from '@/shared/errors/error-codes';

export class ValidationException extends AppException {
  constructor(
    code: ErrorCode | string,
    details?: Record<string, unknown>
  ) {
    const message = getErrorMessage(code as ErrorCode) || '验证错误';
    super(code, 400, message, details);
    this.name = 'ValidationException';
  }
}

export class UnauthorizedException extends AppException {
  constructor(code: ErrorCode | string = 'USER_AUTH_UNAUTHORIZED') {
    super(code, 401, '未授权');
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends AppException {
  constructor(code: ErrorCode | string = 'USER_PERMISSION_DENIED') {
    super(code, 403, '禁止访问');
    this.name = 'ForbiddenException';
  }
}

export class NotFoundException extends AppException {
  constructor(
    code: ErrorCode | string,
    resource?: string,
    identifier?: string | number
  ) {
    super(code, 404, '资源不存在', resource ? { resource, identifier } : undefined);
    this.name = 'NotFoundException';
  }
}

export class ConflictException extends AppException {
  constructor(
    code: ErrorCode | string,
    details?: Record<string, unknown>
  ) {
    super(code, 409, '资源冲突', details);
    this.name = 'ConflictException';
  }
}

export class BusinessException extends AppException {
  constructor(
    code: ErrorCode | string,
    details?: Record<string, unknown>
  ) {
    const message = getErrorMessage(code as ErrorCode) || '业务规则违反';
    super(code, 422, message, details);
    this.name = 'BusinessException';
  }
}

export class SystemException extends AppException {
  constructor(
    code: ErrorCode | string = 'SYSTEM_INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(code, 500, '服务器内部错误', details);
    this.name = 'SystemException';
  }
}

export class DatabaseException extends SystemException {
  constructor(details?: Record<string, unknown>) {
    super('SYSTEM_DATABASE_ERROR', details);
    this.name = 'DatabaseException';
  }
}
