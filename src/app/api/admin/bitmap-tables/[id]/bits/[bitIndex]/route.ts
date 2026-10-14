import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, adminMiddleware, getCurrentUser} from '@/modules/identity/server';
import {getBitmapApplicationService} from '@/modules/tag/server';
import {handleAPIError} from '@/platform/api-error-handler';

export async function DELETE(
    request: NextRequest,
    {params}: { params: Promise<{ id: string; bitIndex: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({error:'请先登录'},{status:401});
    
    const adminError = adminMiddleware(request);
    if (adminError) return adminError;

    try {
        const {id, bitIndex} = await params;
        const bitPosition = parseInt(bitIndex, 10);
        
        if (isNaN(bitPosition) || bitPosition < 0) {
            return NextResponse.json(
                {error: '无效的位索引'},
                {status: 400}
            );
        }
        
        const bitmapApplicationService = getBitmapApplicationService();
        
        const tableDetail = await bitmapApplicationService.getBitmapTableDetail(id,{tenantId:user.ownedBy});
        if (!tableDetail) {
            return NextResponse.json(
                {error: '位图表不存在'},
                {status: 404}
            );
        }
        
        if (bitPosition >= tableDetail.totalBits) {
            return NextResponse.json(
                {error: `Bit index ${bitPosition} exceeds table capacity (${tableDetail.totalBits} bits)`},
                {status: 400}
            );
        }
        
        await bitmapApplicationService.releaseBit(id, bitPosition,{tenantId:user.ownedBy});
        return NextResponse.json({success: true});
    } catch (error) {
        return handleAPIError(error);
    }
}
