import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {managedRiskSegmentOwner} from '../repositories/risk-route-policy';
import {apiError} from '@/shared/lib/api-error';
export async function riskSegmentRouteAuth(request:NextRequest){
    const auth=await authMiddleware(request);if(auth)return auth;
    const match=request.nextUrl.pathname.match(/^\/api\/segments\/([a-f0-9-]{36})(?:\/|$)/i);if(!match)return null;
    try{const owner=await managedRiskSegmentOwner(match[1]);if(owner&&owner!==getCurrentUser(request)?.ownedBy)return NextResponse.json({status:'error',message:'人群不存在或无权访问'},{status:404});return null;}catch(e){return apiError(e);}
}
