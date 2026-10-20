import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {getTagRefreshMonitorService} from '@/modules/tag/server';
import type {MvRefreshStatusReport} from '@/modules/tag/contracts';
import type {MvStatusReportVO} from '@/modules/tag/contracts';
import {getMvStatusQuerySchema} from '@/modules/tag/contracts';
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
    const queryResult = getMvStatusQuerySchema.safeParse({
      status: searchParams.get('status') ?? 'all',
      search: searchParams.get('search') ?? undefined,
      tagId: searchParams.get('tagId') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {error: '无效的查询参数', details: queryResult.error.issues},
        {status: 400}
      );
    }

    const {status, search, tagId} = queryResult.data;
    const monitorService = getTagRefreshMonitorService();

    let reports: MvRefreshStatusReport[];
    try {
      reports = tagId
        ? [await monitorService.checkRefreshStatus(tagId,{tenantId:user.ownedBy})]
        : await monitorService.checkAllRefreshStatus({tenantId:user.ownedBy});
    } catch {
      reports = [];
    }

    let filtered = reports;
    if (status !== 'all') {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.tagName.toLowerCase().includes(lowerSearch) ||
          r.mvName.toLowerCase().includes(lowerSearch)
      );
    }

    const response: MvStatusReportVO[] = filtered.map((r) => ({
      tagId: r.tagId,
      tagName: r.tagName,
      mvName: r.mvName,
      status: r.status,
      statusDescription: r.getStatusDescription(),
      lastRefreshTime: r.lastRefreshTime?.toISOString() ?? null,
      lastException: r.lastException ?? null,
      isStale: r.isStale ?? false,
    }));

    return NextResponse.json(response);
  } catch (error) {
    log.error('GET /api/tags/monitor - Error:', error);
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
