import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskTags} from '@/modules/tag/server';
import {confirmRiskSchema} from '@/modules/tag/contracts';
import {apiError} from '@/shared/lib/api-error';
async function POSTHandler(request:NextRequest,{params}:{params:Promise<{id:string}>}){const e=await authMiddleware(request);if(e)return e;try{const id=z.uuid().parse((await params).id),input=confirmRiskSchema.parse(await request.json().catch(()=>null)),user=getCurrentUser(request)!;return NextResponse.json({status:'ready',data:await riskTags.confirm(user.ownedBy!,user.id!,id,input.version,input.previewToken)});}catch(e){return apiError(e);}}

export const POST=withCompanyRoute(POSTHandler);
