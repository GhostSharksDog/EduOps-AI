import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, adminMiddleware, getCurrentUser} from '@/modules/identity/server';
import {getBitmapApplicationService} from '@/modules/tag/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {execute} from '@/platform/database';

async function GETHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({error:'请先登录'},{status:401});
    
    const adminError = adminMiddleware(request);
    if (adminError) return adminError;

    try {
        const { id } = await params;
        const bitmapApplicationService = getBitmapApplicationService();
        const result = await bitmapApplicationService.getBitmapTableDetail(id,{tenantId:user.ownedBy});
        
        if (!result) {
            return NextResponse.json(
                { error: '位图表不存在' },
                { status: 404 }
            );
        }
        
        return NextResponse.json(result);
    } catch (error) {
        return handleAPIError(error);
    }
}

async function DELETEHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user=getCurrentUser(request);
    if(!user)return NextResponse.json({error:'请先登录'},{status:401});
    
    const adminError = adminMiddleware(request);
    if (adminError) return adminError;

    try {
        const { id } = await params;
        
        // 1. 获取 BitmapTable 详情
        const bitmapApplicationService = getBitmapApplicationService();
        const bitmapTable = await bitmapApplicationService.getBitmapTableDetail(id,{tenantId:user.ownedBy});
        
        if (!bitmapTable) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'BitmapTable 不存在或已被删除' },
                { status: 404 }
            );
        }
        
        // 2. 状态检查 (必须 INACTIVE)
        if (bitmapTable.status === 'ACTIVE') {
            return NextResponse.json(
                { error: 'TABLE_IS_ACTIVE', message: '请先停用该 BitmapTable' },
                { status: 400 }
            );
        }
        
        // 4. 使用检查 (usedBits 必须为空)
        if (bitmapTable.usedBits && bitmapTable.usedBits.length > 0) {
            return NextResponse.json({
                error: 'TABLE_IN_USE',
                message: `该表仍有 ${bitmapTable.usedBits.length} 个 Tag 使用中，无法删除`
            }, { status: 400 });
        }
        
        // 4. 执行软删除
        const currentUser = getCurrentUser(request);
        const changed=await execute(`UPDATE bitmap_table SET is_deleted=true,delete_time=NOW(),update_time=NOW(),deleted_by=$2
          WHERE id=$1 AND owned_by=$3 AND NOT is_deleted AND status!='ACTIVE' AND used_bits='[]'::jsonb`,[id,currentUser?.id??null,currentUser?.ownedBy]);
        if(!changed)return NextResponse.json({error:'操作被拒绝或记录状态已经改变'},{status:409});
        
        return NextResponse.json({
            success: true,
            message: '位图表删除成功'
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
export const DELETE=withCompanyRoute(DELETEHandler);
