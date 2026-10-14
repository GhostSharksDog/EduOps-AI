import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {managedRiskTagOwner} from '../repositories/risk-route-policy';
import {apiError} from '@/shared/lib/api-error';
export async function riskTagRouteAuth(request:NextRequest){
    const auth=await authMiddleware(request);if(auth)return auth;
    const match=request.nextUrl.pathname.match(/^\/api\/tags\/([a-f0-9-]{36})(?:\/|$)/i);
    if(!match)return null;
    let owner:string|null;try{owner=await managedRiskTagOwner(match[1]);}catch(e){return apiError(e);}if(!owner)return null;
    if(owner!==getCurrentUser(request)?.ownedBy)return NextResponse.json({status:'error',message:'标签不存在或无权访问'},{status:404});
    if(['GET','HEAD','OPTIONS'].includes(request.method)&&!request.nextUrl.pathname.includes('/values'))return null;
    return NextResponse.json({status:'error',message:'此出勤标签依据已确认的快照，查看请进入出勤风险标签；修改规则请新建草稿并重新确认。'},{status:409});
}
