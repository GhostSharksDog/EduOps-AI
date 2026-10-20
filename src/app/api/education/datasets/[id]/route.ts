import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {educationData} from '@/modules/education/server';
import {apiError} from '@/shared/lib/api-error';
import {z} from 'zod';
async function GETHandler(request:NextRequest,c:{params:Promise<{id:string}>}){const e=await authMiddleware(request);if(e)return e;try{return NextResponse.json({status:'ready',data:await educationData.inspect(getCurrentUser(request)!.ownedBy!,z.uuid().parse((await c.params).id))});}catch(e){return apiError(e);}}

export const GET=withCompanyRoute(GETHandler);
