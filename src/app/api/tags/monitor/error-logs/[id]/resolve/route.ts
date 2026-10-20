import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {getTagRefreshMonitorService} from '@/modules/tag/server';
import {resolveErrorParamsSchema} from '@/modules/tag/contracts';
import {log} from '@/platform/logger';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';

async function PATCHHandler(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>}
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;
  const user=getCurrentUser(request);
  if(!user)return NextResponse.json({error:'请先登录'},{status:401});

  try {
    const {id} = await params;
    const paramsResult = resolveErrorParamsSchema.safeParse({id});

    if (!paramsResult.success) {
      return NextResponse.json(
        {error: '无效的参数', details: paramsResult.error.issues},
        {status: 400}
      );
    }

    const monitorService = getTagRefreshMonitorService();
    await monitorService.markErrorResolved(id,{tenantId:user.ownedBy});

    return NextResponse.json({success: true});
  } catch (error) {
    log.error('PATCH /api/tags/monitor/error-logs/[id]/resolve - Error:', error);
    return handleAPIError(error);
  }
}

export const PATCH=withCompanyRoute(PATCHHandler);
