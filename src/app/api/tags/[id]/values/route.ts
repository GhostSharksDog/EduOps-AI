import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import {riskTagRouteAuth as authMiddleware} from '@/modules/tag/server';
import { handleAPIError } from '@/platform/api-error-handler';
import {GetTagValuesCommand} from '@/modules/tag/server';
import {getTagValueQueryApplicationService} from '@/modules/tag/server';

/**
 * GET /api/tags/:id/values
 *
 * 批量查询标签值
 * Query params:
 * - entityIds: 逗号分隔的实体 ID 列表（最多 1000 个）
 * - versionId: 可选，版本 ID
 */
async function GETHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const { id: tagId } = await params;
  const searchParams = request.nextUrl.searchParams;

  // 参数解析
  const entityIdsStr = searchParams.get('entityIds');
  const versionId = searchParams.get('versionId') ?? undefined;

  // 参数校验
  if (!entityIdsStr) {
    return NextResponse.json({ error: 'entityIds 参数必填' }, { status: 400 });
  }

  const entityIds = entityIdsStr.split(',').filter(Boolean);

  if (entityIds.length === 0) {
    return NextResponse.json({ error: 'entityIds 不能为空' }, { status: 400 });
  }

  if (entityIds.length > 1000) {
    return NextResponse.json({ error: 'entityIds 最多 1000 个' }, { status: 400 });
  }

  // UUID 格式校验
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidIds = entityIds.filter((entityId) => !uuidRegex.test(entityId));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `entityId 格式错误: ${invalidIds.slice(0, 3).join(', ')}...` },
      { status: 400 }
    );
  }

  try {
    const service = getTagValueQueryApplicationService();

    const result = await service.getTagValues(
      new GetTagValuesCommand(tagId, entityIds, versionId)
    );

    return NextResponse.json({
      data: result.map((r) => ({
        entityId: r.entityId,
        value: r.value,
        calculatedAt: r.calculatedAt,
      })),
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

export const GET=withCompanyRoute(GETHandler);
