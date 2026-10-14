import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskProfiles} from '@/modules/profile/server';
import {profileQuerySchema} from '@/modules/profile/contracts';
import {apiError} from '@/shared/lib/api-error';
export async function POST(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const input=profileQuerySchema.parse(await request.json().catch(()=>null));return NextResponse.json({status:'ready',data:await riskProfiles.query(getCurrentUser(request)!.ownedBy!,input.snapshotId,input.entityId,input.pagination)});}catch(e){return apiError(e);}}
