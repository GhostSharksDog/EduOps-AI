import type {DbClient} from '@/platform/database';
import {BitmapTableVO, BitmapTableDetailVO, BitmapTableListVO} from '@/shared/schemas/response/bitmap-table/index';
import {CreateBitmapTableDTO, UpdateBitmapTableStatusDTO} from '@/shared/schemas/request/bitmap-table/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export interface BitAssignmentResult {
    tagId: string;
    tagName: string;
    bitmapTableId: string;
    bitPosition: number | null;
    bitmapTableName: string;
}

export interface IBitmapApplicationService {
    listBitmapTables(query: {
        entityTypeId?: string;
        entityType?: string;
        status?: string;
        search?: string;
        tenantFilter?: TenantFilterOptions;
    }): Promise<BitmapTableListVO>;

    getBitmapTableDetail(id: string, tenantFilter?: TenantFilterOptions): Promise<BitmapTableDetailVO | null>;

    createBitmapTable(dto: CreateBitmapTableDTO, tenantId?: string): Promise<BitmapTableVO>;

    updateBitmapTableStatus(id: string, dto: UpdateBitmapTableStatusDTO, tenantFilter?: TenantFilterOptions): Promise<BitmapTableVO>;

    releaseBit(bitmapTableId: string, bitPosition: number, tenantFilter?: TenantFilterOptions): Promise<void>;

    getEntityTypes(tenantFilter?: TenantFilterOptions): Promise<{ id: string; name: string }[]>;

    assignBitToTag(
        bitmapTableId: string,
        bitIndex: number,
        tagId: string,
        userId?: string,
        tx?: DbClient,
        enumValue?: string,
        skipAssignBit?: boolean,
        tenantFilter?: TenantFilterOptions,
    ): Promise<BitAssignmentResult>;

    unassignBit(bitmapTableId: string, bitIndex: number, userId?: string, tenantFilter?: TenantFilterOptions): Promise<void>;

    getTagBitAssignment(tagId: string): Promise<BitAssignmentResult | null>;

    /**
     * 检查 Bit 位置是否可用
     * @param bitmapTableId Bitmap 表 ID
     * @param bitPosition Bit 位置
     * @returns 如果位置可用返回 true，否则返回 false
     */
    isBitPositionAvailable(bitmapTableId: string, bitPosition: number): Promise<boolean>;

    releaseUnusedBits(bitmapTableId: string, tenantFilter?: TenantFilterOptions): Promise<{
        releasedCount: number;
        releasedBits: number[];
    }>;

    /**
     * 清理指定标签的所有 TagStorageConfig 记录（软删除）
     * 用于 ENUM 标签重新激活前清除前次失败激活的残留数据
     */
    cleanupTagStorageConfigs(tagId: string): Promise<void>;

    /**
     * 释放标签的所有 bitmap 位（适用于 ENUM 等多 bit 标签）
     * @returns 释放的 bit 位置列表
     */
    unassignAllBitsForTag(tagId: string, userId?: string): Promise<number[]>;
}
