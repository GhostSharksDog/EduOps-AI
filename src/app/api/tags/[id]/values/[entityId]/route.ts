import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import { handleAPIError } from '@/platform/api-error-handler';
import {GetTagValueCommand} from '@/modules/tag/server';
import {getTagValueQueryApplicationService} from '@/modules/tag/server';

/**
 * GET /api/tags/:id/values/:entityId
 *
 * 查询单个实体标签值
 * Query params:
 * - versionId: 可选，版本 ID
 */
async function GETHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId, entityId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const versionId = searchParams.get('versionId') ?? undefined;

  // 参数校验
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(entityId)) {
    return NextResponse.json({ error: 'entityId 格式错误，应为 UUID' }, { status: 400 });
  }

  try {
    const service = getTagValueQueryApplicationService();

    const result = await service.getTagValue(new GetTagValueCommand(tagId, entityId, versionId));

    if (!result) {
      return NextResponse.json({ error: '未找到标签值' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        entityId: result.entityId,
        value: result.value,
        calculatedAt: result.calculatedAt,
      },
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

export const GET=withCompanyRoute(GETHandler);
