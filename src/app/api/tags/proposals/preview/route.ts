import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskTags} from '@/modules/tag/server';
import {apiError} from '@/shared/lib/api-error';
const schema=z.object({proposalId:z.uuid(),version:z.number().int().positive()}).strict();
async function POSTHandler(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const input=schema.parse(await request.json().catch(()=>null));return NextResponse.json({status:'ready',data:await riskTags.preview(getCurrentUser(request)!.ownedBy!,input.proposalId,input.version)});}catch(e){return apiError(e);}}

export const POST=withCompanyRoute(POSTHandler);
