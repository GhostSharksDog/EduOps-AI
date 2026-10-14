import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {journeyQuerySchema} from '@/modules/overview/contracts';
import {queryJourney} from '@/modules/overview/server';
import {apiError} from '@/shared/lib/api-error';
export async function POST(request:NextRequest){const error=await authMiddleware(request);if(error)return error;try{const user=getCurrentUser(request)!;return NextResponse.json({status:'ready',data:await queryJourney(journeyQuerySchema.parse(await request.json()),{organizationId:user.ownedBy!,userId:user.id!,role:user.role!})},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
