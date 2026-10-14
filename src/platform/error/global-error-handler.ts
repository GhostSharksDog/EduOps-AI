import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppException } from '@/shared/errors/base.exception';
import { getRequestContext } from '@/platform/request-context';
import { log } from '@/platform/logger';
import { createApiErrorResponse } from '@/shared/schemas/response/api-error.schema';

export function handleAPIError(error: unknown): NextResponse {
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

  if (error instanceof Error) {
    if (error.message.includes('不存在')) {
      log.error('资源未找到错误', { requestId, message: error.message });
      return NextResponse.json(
        createApiErrorResponse(
          'TAG_RESOURCE_NOT_FOUND',
          error.message,
          404,
          requestId
        ),
        { status: 404 }
      );
    }

    log.error('Unhandled error', {
      requestId,
      message: error.message,
      stack: error.stack,
    });
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

  log.error('Unknown error type', { requestId, error });
  return NextResponse.json(
    createApiErrorResponse(
      'SYSTEM_INTERNAL_ERROR',
      '服务器内部错误',
      500,
      requestId
    ),
    { status: 500 }
  );
}
