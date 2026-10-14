import { NextRequest, NextResponse } from 'next/server';
import {db} from '@/platform/database';
import {getDbBrowserService} from '@/modules/system/server';
import { log } from '@/platform/logger';
import {authMiddleware, adminMiddleware} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';
import { getTablesQuerySchema } from '@/shared/schemas/request/db-browser/query.schema';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '此功能仅在非生产环境可用' }, { status: 403 });
  }

  const authError = await authMiddleware(request) ?? adminMiddleware(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const parseResult = getTablesQuerySchema.safeParse({
      schema: searchParams.get('schema') || 'public',
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { schema } = parseResult.data;
    const service = getDbBrowserService(db);
    const tables = await service.getTables(schema);

    return NextResponse.json({
      success: true,
      data: tables,
    });
  } catch (error) {
    log.error('GET /api/admin/db-browser/tables - Error:', error);
    return handleAPIError(error);
  }
}
