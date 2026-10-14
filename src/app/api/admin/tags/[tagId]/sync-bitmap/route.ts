import {NextRequest, NextResponse} from 'next/server';
import {authMiddleware, adminMiddleware} from '@/modules/identity/server';
import {handleAPIError} from '@/platform/api-error-handler';
import {log} from '@/platform/logger';
import {config} from '@/platform/config/index';
import {TagBitmapSyncRequestSchema} from '@/modules/tag/contracts';
import {TagBitmapSyncResponseSchema} from '@/modules/tag/contracts';
import {getTagBitmapSyncDomainService} from '@/modules/tag/server';
import {getDatabaseTagBitmapSyncStateRepository} from '@/modules/tag/server';
import {getCurrentUser} from '@/modules/identity/server';

/**
 * POST /api/admin/tags/[tagId]/sync-bitmap
 *
 * 手动触发标签 bitmap 同步
 * 支持增量同步和强制全量同步
 */
export async function POST(
    request: NextRequest,
    {params}: { params: Promise<{ tagId: string }> }
) {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    const adminError = adminMiddleware(request);
    if (adminError) return adminError;

    try {
        const {tagId} = await params;

        // 解析请求体
        const body = await request.json();
        const dto = TagBitmapSyncRequestSchema.parse(body);

        // 获取租户 ID
        const user = getCurrentUser(request);
        const ownedBy = user?.ownedBy ?? request.headers.get('x-tenant-id') ?? config.system.userId;

        const syncService = getTagBitmapSyncDomainService();

        // 强制全量同步：重置同步状态为 PENDING
        if (dto.forceFullSync) {
            const syncState = await syncService.getSyncState(tagId, ownedBy);
            if (syncState) {
                const syncStateRepository = getDatabaseTagBitmapSyncStateRepository();
                await syncStateRepository.update(syncState.id, {
                    syncStatus: 'PENDING',
                });
                log.info('强制全量同步：已重置同步状态为 PENDING', {tagId});
            }
        }

        // 执行同步
        const result = await syncService.syncTagBitmap(tagId, ownedBy);

        // 构建响应
        const response = {
            success: result.success,
            syncType: result.syncType,
            syncedCount: result.syncedCount,
            durationMs: result.durationMs,
            error: result.error,
        };

        // 验证响应格式
        const validated = TagBitmapSyncResponseSchema.parse(response);

        return NextResponse.json({
            success: true,
            data: validated,
        });
    } catch (error) {
        log.error('POST /api/admin/tags/[tagId]/sync-bitmap - Error:', error);
        return handleAPIError(error);
    }
}
