import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskSegments} from '@/modules/segment/server';
import {snapshotPageSchema} from '@/modules/segment/contracts';
import {apiError} from '@/shared/lib/api-error';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const e=await authMiddleware(request);if(e)return e;try{const id=z.uuid().parse((await params).id),org=getCurrentUser(request)!.ownedBy!,query=request.nextUrl.searchParams;const data=query.has('page')||query.has('pageSize')?await riskSegments.page(org,id,snapshotPageSchema.parse({page:query.get('page')??undefined,pageSize:query.get('pageSize')??undefined})):await riskSegments.get(org,id);return NextResponse.json({status:'ready',data});}catch(e){return apiError(e);}}
