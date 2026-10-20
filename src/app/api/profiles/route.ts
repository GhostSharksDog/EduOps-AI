import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskProfiles} from '@/modules/profile/server';
import {parseSnapshotFilter} from '@/modules/segment/contracts';
import {apiError} from '@/shared/lib/api-error';
async function GETHandler(request:NextRequest){const e=await authMiddleware(request);if(e)return e;try{const org=getCurrentUser(request)!.ownedBy!,filter=parseSnapshotFilter(request.nextUrl.searchParams);return NextResponse.json({status:'ready',message:'画像依据已计算的人群快照',data:await(request.nextUrl.searchParams.get('summary')==='true'?riskProfiles.summaries(org,filter):riskProfiles.list(org,filter))});}catch(e){return apiError(e);}}

export const GET=withCompanyRoute(GETHandler);
