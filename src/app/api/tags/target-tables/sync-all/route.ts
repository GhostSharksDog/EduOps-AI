import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {getTargetTableApplicationService} from '@/modules/tag/server';

async function POSTHandler(
  request: NextRequest
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const targetTableApplicationService = getTargetTableApplicationService();
    const result = await targetTableApplicationService.syncAllStatus();
    return NextResponse.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

export const POST=withCompanyRoute(POSTHandler);
