import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware, adminMiddleware,getCurrentUser} from '@/modules/identity/server';
import {queryRows} from '@/platform/database';
async function GETHandler(request:NextRequest){const error=await authMiddleware(request)??adminMiddleware(request);if(error)return error;
 try{const users=await queryRows('SELECT id,username,real_name AS "realName",email,role,organization_id AS "organizationId" FROM local_user WHERE organization_id=$1 ORDER BY created_at DESC',[getCurrentUser(request)!.ownedBy]);return NextResponse.json({users:users.map(u=>({...u,ownedBy:u.organizationId}))});}catch{return NextResponse.json({error:'账号服务暂不可用'},{status:503});}
}

export const GET=withCompanyRoute(GETHandler);
