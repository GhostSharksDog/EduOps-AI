import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {getTagRefreshMonitorService, getMvConfigRepository} from '@/modules/tag/server';
import type {ErrorLogVO} from '@/modules/tag/contracts';
import {getErrorLogsQuerySchema} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';

async function GETHandler(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;
  const user=getCurrentUser(request);
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});

  try {
    const {searchParams} = new URL(request.url);
    const queryResult = getErrorLogsQuerySchema.safeParse({
      unresolvedOnly: searchParams.get('unresolvedOnly') ?? 'false',
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {error: '无效的查询参数', details: queryResult.error.issues},
        {status: 400}
      );
    }

    const {unresolvedOnly} = queryResult.data;
    const monitorService = getTagRefreshMonitorService();
    const mvConfigRepository = getMvConfigRepository();
    const errorLogs = await monitorService.getUnresolvedErrors(100,{tenantId:user.ownedBy});

    let filtered = errorLogs;
    if (unresolvedOnly === 'true') {
      filtered = filtered.filter((l) => !l.isResolved);
    }

    const tagIds = new Set(filtered.map((l) => l.tagId));
    const allMvConfigs = await mvConfigRepository.findAllWithTagName({tenantId:user.ownedBy});
    const tagNameMap = new Map(
      allMvConfigs
        .filter((c) => tagIds.has(c.tagId))
        .map((c) => [c.tagId, c.tagName])
    );

    const response: ErrorLogVO[] = filtered.map((l) => ({
      id: l.id,
      tagId: l.tagId,
      tagName: tagNameMap.get(l.tagId) ?? '',
      mvName: l.mvName,
      errorMessage: l.errorMessage ?? '',
      occurredAt: l.occurredAt.toISOString(),
      isSevere: monitorService.isSevereError(l.errorMessage ?? ''),
      isResolved: l.isResolved,
    }));

    return NextResponse.json(response);
  } catch (error) {
    log.error('GET /api/tags/monitor/error-logs - Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {error: '参数验证失败', details: error.issues},
        {status: 400}
      );
    }
    return handleAPIError(error);
  }
}

export const GET=withCompanyRoute(GETHandler);
