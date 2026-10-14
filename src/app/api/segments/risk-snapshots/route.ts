import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskSegments} from '@/modules/segment/server';
import {createRiskSegmentSchema,parseSnapshotFilter} from '@/modules/segment/contracts';
import {apiError} from '@/shared/lib/api-error';
export async function GET(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const org=getCurrentUser(request)!.ownedBy!,filter=parseSnapshotFilter(request.nextUrl.searchParams);return NextResponse.json({status:'ready',data:await(request.nextUrl.searchParams.get('summary')==='true'?riskSegments.summaries(org,filter):riskSegments.list(org,filter))});}catch(e){return apiError(e);}}
export async function POST(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const input=createRiskSegmentSchema.parse(await request.json().catch(()=>null)),user=getCurrentUser(request)!;return NextResponse.json({status:'ready',data:await riskSegments.create(user.ownedBy!,user.id!,input)});}catch(e){return apiError(e);}}
