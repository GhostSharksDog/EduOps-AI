import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {withAudit} from '@/modules/system/server';
import {getTargetTableApplicationService, getTargetTableOHSAdapter} from '@/modules/tag/server';

async function GETHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const {id} = await params;
    const targetTableApplicationService = getTargetTableApplicationService();
    const result = await targetTableApplicationService.getTargetTableById(id);
    
    if (!result) {
      return NextResponse.json(
        {error: '目标表不存在'},
        {status: 404}
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

async function PUTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const {id} = await params;
    const targetTableApplicationService = getTargetTableApplicationService();
    const targetTableOHSAdapter = getTargetTableOHSAdapter();
    
    const dto = await targetTableOHSAdapter.fromRequestToUpdateCommandAsync(request);
    const result = await targetTableApplicationService.updateTargetTable(id, dto);
    return NextResponse.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const {id} = await params;
    const user = getCurrentUser(request);
    const targetTableApplicationService = getTargetTableApplicationService();
    await targetTableApplicationService.deleteTargetTable(id, user?.id);
    
    await withAudit(request, { entityId: id });
    return NextResponse.json({success: true});
  } catch (error) {
    return handleAPIError(error);
  }
}

export const GET=withCompanyRoute(GETHandler);
export const PUT=withCompanyRoute(PUTHandler);
export const DELETE=withCompanyRoute(DELETEHandler);
