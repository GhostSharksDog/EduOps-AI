import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskTags} from '@/modules/tag/server';
import {riskDraftSchema} from '@/modules/tag/contracts';
import {apiError} from '@/shared/lib/api-error';
const updateSchema=riskDraftSchema.extend({version:z.number().int().positive()});
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const e=await authMiddleware(request);if(e)return e;try{const id=z.uuid().parse((await params).id);return NextResponse.json({status:'ready',data:await riskTags.get(getCurrentUser(request)!.ownedBy!,id)});}catch(e){return apiError(e);}}
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){const e=await authMiddleware(request);if(e)return e;try{const id=z.uuid().parse((await params).id),{version,...input}=updateSchema.parse(await request.json().catch(()=>null));return NextResponse.json({status:'ready',data:await riskTags.edit(getCurrentUser(request)!.ownedBy!,id,version,input)});}catch(e){return apiError(e);}}
