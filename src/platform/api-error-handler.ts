import {CapabilityUnavailableError} from '@/shared/contracts/unavailable';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/platform/logger';
import { getRequestContext } from '@/platform/request-context';
import { AppException } from '@/shared/errors/base.exception';
import { createApiErrorResponse } from '@/shared/schemas/response/api-error.schema';

export function is404Response(response: Response): boolean {
    return response.status === 404;
}

export class ApiResponseError extends Error {
    public statusCode: number;
    public errorCode?: string;
    public get code(): string | undefined {
        return this.errorCode;
    }

    constructor(message: string, statusCode: number, errorCode?: string) {
        super(message);
        this.name = 'ApiResponseError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }
}

export function throwNotFound(message: string = '资源不存在', errorCode?: string): never {
    throw new ApiResponseError(message, 404, errorCode);
}

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string) {
    super(404, `${resource}不存在`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = '未授权') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = '权限不足') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export function handleAPIError(error: unknown): NextResponse {
  if(error instanceof CapabilityUnavailableError)return NextResponse.json({status:'not_implemented',error:error.message,code:error.code,data:null},{status:501});
  const ctx = getRequestContext();
  const requestId = ctx?.requestId || crypto.randomUUID();

  if (error instanceof AppException) {
    log.error('AppException', {
      requestId,
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      details: error.details,
    });
    return NextResponse.json(
      createApiErrorResponse(
        error.code,
        error.message,
        error.httpStatus,
        requestId,
        error.details
      ),
      { status: error.httpStatus }
    );
  }

  if (error instanceof z.ZodError) {
    const issues = error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    log.error('Zod validation error', { requestId, issues });
    return NextResponse.json(
      createApiErrorResponse(
        'VALIDATION_REQUEST_BODY_INVALID',
        '请求参数验证失败',
        400,
        requestId,
        { issues }
      ),
      { status: 400 }
    );
  }

  if (error instanceof APIError) {
    log.error('APIError', { requestId, code: error.code, message: error.message, statusCode: error.statusCode });
    return NextResponse.json(
      createApiErrorResponse(
        error.code || 'UNKNOWN_ERROR',
        error.message,
        error.statusCode,
        requestId
      ),
      { status: error.statusCode }
    );
  }

  // Handle "not found" error messages
  if (error instanceof Error && error.message.includes('不存在')) {
    log.error('资源未找到错误', { requestId, message: error.message });
    return NextResponse.json(
      createApiErrorResponse('TAG_RESOURCE_NOT_FOUND', error.message, 404, requestId),
      { status: 404 }
    );
  }

  // Handle duplicate / conflict errors from domain layer
  if (error instanceof Error && error.message.includes('已存在')) {
    log.error('资源冲突错误', { requestId, message: error.message });
    return NextResponse.json(
      createApiErrorResponse('RESOURCE_CONFLICT', error.message, 409, requestId),
      { status: 409 }
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    log.error('Unhandled error', { requestId, message: error.message, stack: error.stack });
    return NextResponse.json(
      createApiErrorResponse(
        'SYSTEM_INTERNAL_ERROR',
        process.env.NODE_ENV === 'production' ? '服务器内部错误' : error.message,
        500,
        requestId
      ),
      { status: 500 }
    );
  }

  // Unknown error type
  log.error('Unknown error type', { requestId, error });
  return NextResponse.json(
    createApiErrorResponse('SYSTEM_INTERNAL_ERROR', '服务器内部错误', 500, requestId),
    { status: 500 }
  );
}
