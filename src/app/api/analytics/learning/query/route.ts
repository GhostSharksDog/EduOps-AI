import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {learningAnalytics} from '@/modules/analytics/server';
import {learningQuerySchema} from '@/modules/analytics/contracts';
import {apiError} from '@/shared/lib/api-error';
export async function POST(request:NextRequest){const error=await authMiddleware(request);if(error)return error;try{const input=learningQuerySchema.parse(await request.json().catch(()=>null));const data=await learningAnalytics.query(input.datasetId,{...input.learningScope,organizationId:getCurrentUser(request)!.ownedBy!});return NextResponse.json({status:'ready',data});}catch(error){return apiError(error);}}
