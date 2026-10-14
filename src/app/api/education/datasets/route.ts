import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {educationData} from '@/modules/education/server';
import {datasetSchema} from '@/modules/education/contracts';
import {apiError} from '@/shared/lib/api-error';
export async function GET(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{return NextResponse.json({status:'ready',data:await educationData.listDatasets(getCurrentUser(request)!.ownedBy!)});}catch(e){return apiError(e);}}
export async function POST(request:NextRequest){const e=await authMiddleware(request);if(e)return e;if(!['admin','operator'].includes(getCurrentUser(request)!.role))return NextResponse.json({status:'error',message:'只读用户不能创建或导入业务数据',data:null},{status:403});try{return NextResponse.json({status:'ready',data:await educationData.createDataset(getCurrentUser(request)!.ownedBy!,datasetSchema.parse(await request.json().catch(()=>null)))},{status:201});}catch(e){return apiError(e);}}
