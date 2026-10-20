import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskTags} from '@/modules/tag/server';
import {riskDraftSchema} from '@/modules/tag/contracts';
import {apiError} from '@/shared/lib/api-error';
async function GETHandler(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{return NextResponse.json({status:'ready',data:await riskTags.list(getCurrentUser(request)!.ownedBy!)});}catch(e){return apiError(e);}}
async function POSTHandler(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const input=riskDraftSchema.parse(await request.json().catch(()=>null)),user=getCurrentUser(request)!;return NextResponse.json({status:'ready',data:await riskTags.create(user.ownedBy!,user.id!,input)},{status:201});}catch(e){return apiError(e);}}

export const GET=withCompanyRoute(GETHandler);
export const POST=withCompanyRoute(POSTHandler);
