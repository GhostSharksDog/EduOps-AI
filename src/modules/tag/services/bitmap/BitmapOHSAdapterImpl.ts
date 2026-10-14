import {NextRequest} from 'next/server';
import {IBitmapOHSAdapter, BitmapTableEntity} from '@/modules/tag/services/bitmap/IBitmapOHSAdapter';
import {BitmapTableVO, BitmapTableDetailVO, BitInfoVO} from '@/shared/schemas/response/bitmap-table/index';
import {CreateBitmapTableDTO, UpdateBitmapTableStatusDTO} from '@/shared/schemas/request/bitmap-table/index';
import {createBitmapTableSchema, updateBitmapTableStatusSchema} from '@/shared/schemas/request/bitmap-table/index';
import {getCurrentTenantId, createTenantFilter, TenantFilterOptions} from '@/platform/get-current-tenant';

export class BitmapOHSAdapterImpl implements IBitmapOHSAdapter {
    async fromRequestToCreateCommand(request: NextRequest): Promise<CreateBitmapTableDTO> {
        const body = await request.json();
        return createBitmapTableSchema.parse(body);
    }

    async fromRequestToUpdateStatusCommand(request: NextRequest, id: string): Promise<UpdateBitmapTableStatusDTO & { id: string }> {
        const body = await request.json();
        const dto = updateBitmapTableStatusSchema.parse(body);
        return { ...dto, id };
    }

    fromRequestToListQuery(request: NextRequest): {
        entityTypeId?: string;
        entityType?: string;
        status?: string;
        search?: string;
        tenantFilter?: TenantFilterOptions;
    } {
        const {searchParams} = new URL(request.url);
        const tenantId = getCurrentTenantId(request);
        return {
            entityTypeId: searchParams.get('entityTypeId') || undefined,
            entityType: searchParams.get('entityType') || undefined,
            status: searchParams.get('status') || undefined,
            search: searchParams.get('search') || undefined,
            tenantFilter: createTenantFilter(tenantId),
        };
    }

    fromEntityToVO(entity: BitmapTableEntity): BitmapTableVO {
        const tableName = entity.chTableName ?? this.generateTableName(entity.entityTypeId, entity.sequence);

        return {
            id: entity.id,
            tableName,
            // 新增字段映射：名称与描述
            name: entity.name ?? null,
            description: entity.description ?? null,
            entityType: entity.entityType,
            entityTypeId: entity.entityTypeId,
            ownedBy: entity.ownedBy,
            totalBits: entity.totalBits,
            usedBits: entity.usedBits,
            status: entity.status as 'ACTIVE' | 'INACTIVE',
            createTime: entity.createTime.toISOString(),
            updateTime: entity.updateTime?.toISOString() || null,
        };
    }

    fromEntityToDetailVO(entity: BitmapTableEntity, bits: BitInfoVO[]): BitmapTableDetailVO {
        const base = this.fromEntityToVO(entity);
        return {
            ...base,
            bits,
        };
    }

    generateTableName(entityTypeId: string, sequence: number): string {
        const shortId = entityTypeId.replace(/-/g, '').substring(0, 8);
        return `tag_bitmap_${shortId}_${sequence}`;
    }
}
