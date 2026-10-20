import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {educationData} from '@/modules/education/server';
import {importInputSchema} from '@/modules/education/contracts';
import {apiError} from '@/shared/lib/api-error';
async function POSTHandler(request:NextRequest){const e=await authMiddleware(request);if(e)return e;if(!['admin','operator'].includes(getCurrentUser(request)!.role))return NextResponse.json({status:'error',message:'只读用户不能创建或导入业务数据',data:null},{status:403});try{const input=importInputSchema.parse(await request.json().catch(()=>null)),job=await educationData.importCsv(getCurrentUser(request)!.ownedBy!,input);return NextResponse.json({status:job.status==='failed'?'error':'ready',message:job.error,data:job},{status:job.status==='failed'?422:job.status==='completed'?200:202});}catch(e){return apiError(e);}}
async function GETHandler(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const detail=await educationData.inspect(getCurrentUser(request)!.ownedBy!,z.uuid().parse(request.nextUrl.searchParams.get('datasetId')));return NextResponse.json({status:'ready',data:detail.batches});}catch(e){return apiError(e);}}

export const POST=withCompanyRoute(POSTHandler);
export const GET=withCompanyRoute(GETHandler);
