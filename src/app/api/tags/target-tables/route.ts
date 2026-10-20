import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {getTargetTableApplicationService, getTargetTableOHSAdapter} from '@/modules/tag/server';

async function GETHandler(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const targetTableApplicationService = getTargetTableApplicationService();
    const targetTableOHSAdapter = getTargetTableOHSAdapter();
    
    const query = targetTableOHSAdapter.fromRequestToListQuery(request);
    const tenantId = request.headers.get('x-tenant-id') as string | undefined;
    const result = await targetTableApplicationService.listTargetTables(query, tenantId);
    return NextResponse.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

async function POSTHandler(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const targetTableApplicationService = getTargetTableApplicationService();
    const targetTableOHSAdapter = getTargetTableOHSAdapter();
    
    const dto = await targetTableOHSAdapter.fromRequestToCreateCommandAsync(request);
    const tenantId = request.headers.get('x-tenant-id') as string | undefined;
    const result = await targetTableApplicationService.createTargetTable(dto, tenantId);
    return NextResponse.json(result, {status: 201});
  } catch (error) {
    return handleAPIError(error);
  }
}

export const GET=withCompanyRoute(GETHandler);
export const POST=withCompanyRoute(POSTHandler);
