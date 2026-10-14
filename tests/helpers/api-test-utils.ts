import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { authHeaders, missingAuthResponse, serviceErrorResponse } from './auth';

/**
 * Creates a mock NextRequest with optional body and auth
 */
export function createMockRequest(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: Record<string, unknown>;
    includeAuth?: boolean;
  } = {}
): NextRequest {
  const { method = 'GET', body, includeAuth = true } = options;

  const headers = new Headers();
  if (includeAuth) {
    headers.set('Authorization', authHeaders.Authorization);
  }
  headers.set('Content-Type', 'application/json');

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Standard test cases for API routes - use in describe blocks
 */
export const apiTestCases = {
  unauthorized: {
    name: '当缺少JWT令牌时，应返回401错误',
    expectedStatus: 401,
    expectedResponse: missingAuthResponse,
  },
  serviceError: {
    name: '当应用服务失败时，应返回500错误',
    expectedStatus: 500,
    expectedResponse: serviceErrorResponse,
  },
} as const;

/**
 * Assert response matches expected values
 */
export async function assertResponse(
  response: Response,
  expectedStatus: number,
  expectedData?: Record<string, unknown>
): Promise<void> {
  expect(response.status).toBe(expectedStatus);
  if (expectedData) {
    const data = await response.json();
    expect(data).toMatchObject(expectedData);
  }
}
