import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import {getBitmapApplicationService} from '@/modules/tag/server';
import {handleAPIError} from '@/platform/api-error-handler';

async function POSTHandler(
    request: NextRequest,
    {params}: {params: Promise<{id: string}>}
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({error:'请先登录'},{status:401});

    try {
        const {id} = await params;
        const bitmapApplicationService = getBitmapApplicationService();

        const result = await bitmapApplicationService.releaseUnusedBits(id,{tenantId:user.ownedBy});

        return NextResponse.json({
            success: true,
            releasedCount: result.releasedCount,
            releasedBits: result.releasedBits,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

export const POST=withCompanyRoute(POSTHandler);
