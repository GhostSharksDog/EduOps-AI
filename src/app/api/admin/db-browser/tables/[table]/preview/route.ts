import { NextRequest, NextResponse } from 'next/server';
import {db} from '@/platform/database';
import {getDbBrowserService} from '@/modules/system/server';
import { log } from '@/platform/logger';
import {authMiddleware, adminMiddleware} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '此功能仅在非生产环境可用' }, { status: 403 });
  }

  const authError = await authMiddleware(request) ?? adminMiddleware(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const schema = searchParams.get('schema') || 'public';
  const { table } = await params;

  if (!VALID_IDENTIFIER.test(schema) || !VALID_IDENTIFIER.test(table)) {
    return NextResponse.json({ error: '无效的 schema 或 table 名称' }, { status: 400 });
  }

  try {
    const service = getDbBrowserService(db);
    const preview = await service.getPreview(schema, table);

    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    log.error('GET preview - Error:', error);
    return handleAPIError(error);
  }
}
