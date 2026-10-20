import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, adminMiddleware, getCurrentUser} from '@/modules/identity/server';
import {getBitmapApplicationService} from '@/modules/tag/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {updateBitmapTableStatusSchema} from '@/shared/schemas/request/bitmap-table/index';

async function PATCHHandler(
    request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({error:'请先登录'},{status:401});
    
    const adminError = adminMiddleware(request);
    if (adminError) return adminError;

    try {
        const {id} = await params;
        const body = await request.json();
        const dto = updateBitmapTableStatusSchema.parse(body);
        
        const bitmapApplicationService = getBitmapApplicationService();
        const result = await bitmapApplicationService.updateBitmapTableStatus(id, dto,{tenantId:user.ownedBy});
        return NextResponse.json(result);
    } catch (error) {
        return handleAPIError(error);
    }
}

export const PATCH=withCompanyRoute(PATCHHandler);
