import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskTags} from '@/modules/tag/server';
import {apiError} from '@/shared/lib/api-error';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const e=await authMiddleware(request);if(e)return e;try{return NextResponse.json({status:'ready',data:await riskTags.published(getCurrentUser(request)!.ownedBy!,z.uuid().parse((await params).id))});}catch(e){return apiError(e);}}
