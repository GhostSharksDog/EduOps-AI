import {NextRequest,NextResponse} from 'next/server';
import {withCompanyRoute,authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {queryWorkbench} from '@/modules/overview/server';
import {workbenchQuerySchema} from '@/shared/contracts/workbench';
import {apiError} from '@/shared/lib/api-error';
import {WorkflowError} from '@/shared/errors/workflow-error';

async function GETHandler(request:NextRequest){
 const denied=await authMiddleware(request);if(denied)return denied;
 try{
  const params=request.nextUrl.searchParams;
  for(const key of params.keys())if(params.getAll(key).length!==1)throw new WorkflowError('请求参数重复，请重新选择筛选',400);
  const input=workbenchQuerySchema.parse(Object.fromEntries(params)),user=getCurrentUser(request)!;
  const data=await queryWorkbench(input,{organizationId:user.ownedBy!,userId:user.id!,role:user.role!});
  return NextResponse.json({status:'ready',data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
export const GET=withCompanyRoute(GETHandler);
