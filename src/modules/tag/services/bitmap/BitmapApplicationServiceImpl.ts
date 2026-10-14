import {IBitmapApplicationService, BitAssignmentResult} from '@/modules/tag/services/bitmap/IBitmapApplicationService';
import {BitmapTableVO, BitmapTableDetailVO, BitmapTableListVO, BitInfoVO} from '@/shared/schemas/response/bitmap-table/index';
import {CreateBitmapTableDTO, UpdateBitmapTableStatusDTO} from '@/shared/schemas/request/bitmap-table/index';
import {IBitmapManagementDomainService} from '@/modules/tag/domain/services/ports/IBitmapManagementDomainService';
import {IBitmapTableRepository} from '@/modules/tag/domain/ports/IBitmapTableRepository';
import {IBitmapOHSAdapter, BitmapTableEntity} from '@/modules/tag/services/bitmap/IBitmapOHSAdapter';
import {ITagStorageConfigRepository} from '@/modules/tag/domain/ports/ITagStorageConfigRepository';
import {transaction,execute,type DbClient} from '@/platform/database';
import {tagOne,tagRows} from '@/modules/tag/repositories/sql';
import type {Tag,TagStorageConfig} from '@/modules/tag/repositories/row-types';
import {config} from '@/platform/config/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';
import {ConflictException, NotFoundException, BusinessException} from '@/shared/errors/index';
import {log} from '@/platform/logger';

export class BitmapApplicationServiceImpl implements IBitmapApplicationService {
    constructor(
        private readonly bitmapDomainService: IBitmapManagementDomainService,
        private readonly bitmapRepository: IBitmapTableRepository,
        private readonly ohsAdapter: IBitmapOHSAdapter,
        private readonly tagStorageConfigRepository: ITagStorageConfigRepository
    ) {}

    async listBitmapTables(query: {
        entityTypeId?: string;
        entityType?: string;
        status?: string;
        search?: string;
        tenantFilter?: TenantFilterOptions;
    }): Promise<BitmapTableListVO> {
        const effectiveEntityTypeId = query.entityTypeId || query.entityType;
        
        const allTables = effectiveEntityTypeId 
            ? await this.bitmapRepository.findByEntityTypeId(effectiveEntityTypeId, false, query.tenantFilter)
            : await this.bitmapRepository.findAll(query.tenantFilter);
        
        let filtered = allTables.filter(t => !t.deleteTime);
        
        if (query.status) {
            filtered = filtered.filter(t => t.status === query.status);
        }
        
        if (query.search) {
            const searchLower = query.search.toLowerCase();
            filtered = filtered.filter(t => 
                t.entityType.toLowerCase().includes(searchLower) ||
                t.entityTypeId.toLowerCase().includes(searchLower) ||
                t.id.toLowerCase().includes(searchLower)
            );
        }

        const items = filtered.map(t => this.ohsAdapter.fromEntityToVO(this.toEntity(t)));

        return {
            items,
            total: items.length,
        };
    }

    async getBitmapTableDetail(id: string, tenantFilter?: TenantFilterOptions): Promise<BitmapTableDetailVO | null> {
        const authorized = await this.bitmapRepository.findById(id,tenantFilter);
        if (!authorized || authorized.deleteTime || authorized.isDeleted) return null;
        await this.syncUsedBits(id,tenantFilter);
        const table = await this.bitmapRepository.findById(id,tenantFilter);
        if (!table || table.deleteTime || table.isDeleted) return null;

        const bits: BitInfoVO[] = [];
        for (let i = 0; i < table.totalBits; i++) {
            const isUsed = table.usedBits.includes(i);
            let tagInfo: { tagId: string | null; tagName: string | null; enumValue: string | null } = { tagId: null, tagName: null, enumValue: null };
            
            if (isUsed) {
                tagInfo = await this.getTagInfoForBit(table.id, i,tenantFilter);
            }
            
            bits.push({
                index: i,
                tagId: tagInfo.tagId,
                tagName: tagInfo.tagName,
                enumValue: tagInfo.enumValue,
            });
        }

        return this.ohsAdapter.fromEntityToDetailVO(this.toEntity(table), bits);
    }

    async createBitmapTable(dto: CreateBitmapTableDTO, tenantId?: string): Promise<BitmapTableVO> {
        const tenantFilter={tenantId:tenantId??config.system.userId};
        const existingActive = await this.bitmapRepository.findActiveByEntityTypeId(dto.entityTypeId,tenantFilter);
        if (existingActive) {
            throw new ConflictException('TAG_BITMAP_TABLE_ACTIVE_EXISTS', { entityTypeId: dto.entityTypeId });
        }

        const bitmapTableData = await this.bitmapDomainService.getOrCreateBitmapTable(
            dto.entityTypeId,
            dto.entityType,
            tenantId
        );

        // 将可选字段合并到待写入的数据中，确保 name/description 能被持久化
        const mergedData = {
            ...bitmapTableData,
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.totalBits !== undefined ? { totalBits: dto.totalBits } : {}),
        } as any;

        if (dto.name!==undefined || dto.description!==undefined || (dto.totalBits && dto.totalBits !== 64)) {
            const updated = await this.bitmapRepository.update({
                ...mergedData,
            } as any,tenantFilter);
            return this.ohsAdapter.fromEntityToVO(this.toEntity(updated as any));
        }

        return this.ohsAdapter.fromEntityToVO(this.toEntity(mergedData as any));
    }

    async updateBitmapTableStatus(id: string, dto: UpdateBitmapTableStatusDTO,tenantFilter?: TenantFilterOptions): Promise<BitmapTableVO> {
        const table = await this.bitmapRepository.findById(id,tenantFilter);
        if (!table || table.deleteTime || table.isDeleted) {
            throw new NotFoundException('TAG_RESOURCE_NOT_FOUND', 'BitmapTable', id);
        }

        if (dto.status === 'INACTIVE' && table.usedBits.length > 0) {
            throw new BusinessException(
                'TAG_BITMAP_TABLE_HAS_USED_BITS',
                {
                    usedBitCount: table.usedBits.length,
                    bitmapTableId: id
                }
            );
        }

        if (dto.status === 'ACTIVE') {
            const existingActive = await this.bitmapRepository.findActiveByEntityTypeId(table.entityTypeId,{tenantId:table.ownedBy});
            if (existingActive && existingActive.id !== id) {
                throw new ConflictException('TAG_BITMAP_TABLE_ACTIVE_EXISTS', { entityTypeId: table.entityTypeId });
            }
        }

        const updated = await this.bitmapRepository.update({
            ...table,
            status: dto.status,
        },tenantFilter);

        return this.ohsAdapter.fromEntityToVO(this.toEntity(updated));
    }

    async releaseBit(bitmapTableId: string, bitPosition: number,tenantFilter?: TenantFilterOptions): Promise<void> {
        const table=await this.bitmapRepository.findById(bitmapTableId,tenantFilter);
        if(!table || table.deleteTime || table.isDeleted)throw new NotFoundException('TAG_BITMAP_TABLE_NOT_FOUND','BitmapTable',bitmapTableId);
        await this.bitmapDomainService.releaseBit(bitmapTableId, bitPosition);
    }

    async getEntityTypes(tenantFilter?: TenantFilterOptions): Promise<{ id: string; name: string }[]> {
        const allTables = await this.bitmapRepository.findAll(tenantFilter);
        const activeTables = allTables.filter(t => !t.deleteTime);
        
        const typeMap = new Map<string, string>();
        activeTables.forEach(t => {
            if (!typeMap.has(t.entityTypeId)) {
                typeMap.set(t.entityTypeId, t.entityType);
            }
        });
        
        return Array.from(typeMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async assignBitToTag(
        bitmapTableId: string,
        bitIndex: number,
        tagId: string,
        userId?: string,
        externalTx?: DbClient,
        enumValue?: string,
        skipAssignBit?: boolean,
        tenantFilter?: TenantFilterOptions,
    ): Promise<BitAssignmentResult> {
        const bitmapTable = await this.bitmapRepository.findById(bitmapTableId,tenantFilter);
        if (!bitmapTable || bitmapTable.deleteTime || bitmapTable.isDeleted) {
            throw new NotFoundException('TAG_BITMAP_TABLE_NOT_FOUND', 'BitmapTable', bitmapTableId);
        }

        if (bitIndex < 0 || bitIndex >= bitmapTable.totalBits) {
            throw new BusinessException('TAG_BIT_INDEX_OUT_OF_RANGE', { 
                bitIndex, 
                maxBits: bitmapTable.totalBits 
            });
        }
        const tag = await tagOne<Tag>('SELECT * FROM tag WHERE id=$1 AND is_deleted=FALSE'+(tenantFilter?.tenantId?' AND owned_by=$2::uuid':''),tenantFilter?.tenantId?[tagId,tenantFilter.tenantId]:[tagId],externalTx,'tag');
        if (!tag || tag.ownedBy!==bitmapTable.ownedBy) throw new NotFoundException('TAG_NOT_FOUND','Tag',tagId);

        const existingAssignment = await this.tagStorageConfigRepository.findByTagId(tagId);
        // ENUM 类型允许同 tagId 多条记录（不同 enumValue），其他类型只允许一条
        if (existingAssignment && (!enumValue || existingAssignment.enumValue === '')) {
            throw new ConflictException('TAG_BIT_ALREADY_ASSIGNED', { tagId });
        }

        // 检查是否存在已软删除的同 (tagId, enumValue) 记录，有则恢复而非新建
        const deletedAssignment = enumValue
            ? await this.tagStorageConfigRepository.findAnyByTagIdAndEnumValue(tagId, enumValue)
            : await this.tagStorageConfigRepository.findAnyByTagId(tagId);

        const bitAssignment = await this.tagStorageConfigRepository.findByBitmapIdAndBitPosition(
            bitmapTableId,
            bitIndex
        );
        if (bitAssignment) {
            throw new ConflictException('TAG_BIT_POSITION_OCCUPIED', { 
                bitmapTableId, 
                bitIndex 
            });
        }

        // 检查是否有软删除的记录占着唯一约束 (bitmapTableId, bitPosition)
        // 如果有，需要先清除该记录的 bitPosition 再分配给新标签
        const deletedBitHolder = await this.tagStorageConfigRepository.findAnyByBitmapIdAndBitPosition(
            bitmapTableId,
            bitIndex
        );

        const bitmapTableName = bitmapTable.chTableName ?? `tag_bitmap_${bitmapTable.entityTypeId}_${bitmapTable.sequence}`;

        const doAssign = async (tx: DbClient) => {
            // 如果有软删除的记录占着 (bitmapTableId, bitPosition) 唯一约束，先释放
            if (deletedBitHolder && deletedBitHolder.id !== deletedAssignment?.id) {
                await this.tagStorageConfigRepository.update(deletedBitHolder.id, {
                    bitPosition: null,
                    bitmapTableId: null,
                    updatedBy: userId,
                }, tx);
            }

            // 如果 bit 已由 allocateBits 预先分配，跳过重复的 assignBitAt
            if (!skipAssignBit) {
                await this.bitmapRepository.assignBitAt(bitmapTableId, bitIndex, tx);
            }

            if (deletedAssignment) {
                await this.tagStorageConfigRepository.update(deletedAssignment.id, {
                    bitmapTableName,
                    bitPosition: bitIndex,
                    storageType: 'BITMAP',
                    entityType: bitmapTable.entityType,
                    bitmapTableId,
                    updatedBy: userId,
                    restore: true,
                }, tx);
            } else {
                await this.tagStorageConfigRepository.create({
          tagId,
          bitmapTableName,
          bitPosition: bitIndex,
          enumValue: enumValue || '',
          storageType: 'BITMAP',
                    entityType: bitmapTable.entityType,
                    bitmapTableId,
                    ownedBy: tag.ownedBy,
                    createdBy: userId,
                }, tx);
            }
        };

        if (externalTx) {
            await doAssign(externalTx);
        } else {
            await transaction(async (tx) => {
                await doAssign(tx);
            });
        }

        return {
            tagId,
            tagName: tag.name,
            bitmapTableId,
            bitPosition: bitIndex,
            bitmapTableName,
        };
    }

    async unassignBit(bitmapTableId: string, bitIndex: number, userId?: string,tenantFilter?: TenantFilterOptions): Promise<void> {
        const table=await this.bitmapRepository.findById(bitmapTableId,tenantFilter);
        if(!table || table.deleteTime || table.isDeleted)throw new NotFoundException('TAG_BITMAP_TABLE_NOT_FOUND','BitmapTable',bitmapTableId);
        const bitAssignment = await this.tagStorageConfigRepository.findByBitmapIdAndBitPosition(
            bitmapTableId,
            bitIndex
        );

        if (!bitAssignment) {
            throw new BusinessException('TAG_BIT_NOT_ASSIGNED', { 
                bitmapTableId, 
                bitIndex 
            });
        }
        if(bitAssignment.ownedBy!==table.ownedBy)throw new NotFoundException('TAG_NOT_FOUND','Tag',bitAssignment.tagId);

        const tag = await tagOne<Tag>('SELECT * FROM tag WHERE id=$1',[bitAssignment.tagId],undefined,'tag');
        if(tag && tag.ownedBy!==table.ownedBy)throw new NotFoundException('TAG_NOT_FOUND','Tag',bitAssignment.tagId);
        
        if (tag && tag.status === 'ACTIVE') {
            throw new BusinessException('TAG_BIT_CANNOT_UNASSIGN_ACTIVE', { 
                tagId: tag.id,
                tagName: tag.name 
            });
        }

        await transaction(async (tx) => {
            await this.bitmapRepository.releaseBitAt(bitmapTableId, bitIndex, tx);
            await this.tagStorageConfigRepository.delete(bitAssignment.id, userId, tx);
        });
    }

    async getTagBitAssignment(tagId: string): Promise<BitAssignmentResult | null> {
        const config = await this.tagStorageConfigRepository.findByTagId(tagId);
        if (!config || !config.bitmapTableId) {
            return null;
        }

        const tag = await tagOne<Tag>('SELECT * FROM tag WHERE id=$1',[tagId],undefined,'tag');
        
        return {
            tagId,
            tagName: tag?.name || '',
            bitmapTableId: config.bitmapTableId,
            bitPosition: config.bitPosition,
            bitmapTableName: config.bitmapTableName,
        };
    }

    /**
     * 同步 usedBits 和 tagStorageConfig 的一致性
     * - tagStorageConfig 有记录但 usedBits 不包含 → 补上 usedBits
     * - usedBits 包含但 tagStorageConfig 无记录 → 从 usedBits 移除
     */
    private async syncUsedBits(bitmapTableId: string,tenantFilter?: TenantFilterOptions): Promise<void> {
        const bitmapTable = await this.bitmapRepository.findById(bitmapTableId,tenantFilter);
        if (!bitmapTable || bitmapTable.deleteTime || bitmapTable.isDeleted) return;

        const allAssignments = await tagRows<TagStorageConfig>('SELECT * FROM tag_storage_config WHERE bitmap_table_id=$1 AND delete_time IS NULL AND bit_position IS NOT NULL',[bitmapTableId]);
        const configBits = new Set(allAssignments.map(a => a.bitPosition).filter((b): b is number => b !== null));
        const currentUsedBits = new Set(bitmapTable.usedBits);

        let changed = false;

        // tagStorageConfig 有但 usedBits 没有 → 补上
        for (const bit of configBits) {
            if (!currentUsedBits.has(bit)) {
                currentUsedBits.add(bit);
                changed = true;
            }
        }

        // usedBits 有但 tagStorageConfig 没有 → 移除孤儿位
        for (const bit of [...currentUsedBits]) {
            if (!configBits.has(bit)) {
                currentUsedBits.delete(bit);
                changed = true;
            }
        }

        if (changed) {
            const sortedBits = [...currentUsedBits].sort((a, b) => a - b);
            await execute('UPDATE bitmap_table SET used_bits=$2::jsonb,update_time=NOW() WHERE id=$1',[bitmapTableId,JSON.stringify(sortedBits)]);
            log.info('已同步 usedBits 一致性', { bitmapTableId, usedBits: sortedBits });
        }
    }

    async isBitPositionAvailable(bitmapTableId: string, bitPosition: number): Promise<boolean> {
        await this.syncUsedBits(bitmapTableId);

        const bitmapTable = await this.bitmapRepository.findById(bitmapTableId);
        if (!bitmapTable) {
            return false;
        }

        if (bitPosition < 0 || bitPosition >= bitmapTable.totalBits) {
            return false;
        }

        if (bitmapTable.usedBits.includes(bitPosition)) {
            return false;
        }

        // 检查 tagStorageConfig 是否有记录
        const existingAssignment = await this.tagStorageConfigRepository.findByBitmapIdAndBitPosition(
            bitmapTableId,
            bitPosition
        );
        return !existingAssignment;
    }

    async releaseUnusedBits(bitmapTableId: string,tenantFilter?: TenantFilterOptions): Promise<{
        releasedCount: number;
        releasedBits: number[];
    }> {
        const bitmapTable = await this.bitmapRepository.findById(bitmapTableId,tenantFilter);
        if (!bitmapTable || bitmapTable.deleteTime || bitmapTable.isDeleted) throw new NotFoundException('TAG_BITMAP_TABLE_NOT_FOUND','BitmapTable',bitmapTableId);

        const allAssignments = await tagRows<TagStorageConfig>('SELECT * FROM tag_storage_config WHERE bitmap_table_id=$1 AND delete_time IS NULL AND bit_position IS NOT NULL',[bitmapTableId]);

        const releasedBits: number[] = [];
        const assignedBitPositions = new Set<number>();
        const currentUsedBits = new Set(bitmapTable.usedBits);
        
        for (const assignment of allAssignments) {
            const bitPosition = assignment.bitPosition;
            if (bitPosition === null) continue;
            assignedBitPositions.add(bitPosition);
            
            const tag = await tagOne<Tag>('SELECT * FROM tag WHERE id=$1',[assignment.tagId],undefined,'tag');
            
            if (!tag || tag.isDeleted || tag.status === 'DEPRECATED' || tag.status === 'INACTIVE') {
                if (currentUsedBits.has(bitPosition)) {
                    await this.bitmapRepository.releaseBitAt(bitmapTableId, bitPosition);
                    currentUsedBits.delete(bitPosition);
                }
                await this.tagStorageConfigRepository.delete(assignment.id);
                releasedBits.push(bitPosition);
            }
        }

        // 清理孤儿位：usedBits 中存在但无对应 TagStorageConfig 记录的位
        const orphanBits = [...currentUsedBits].filter(bit => !assignedBitPositions.has(bit));
        for (const orphanBit of orphanBits) {
            await this.bitmapRepository.releaseBitAt(bitmapTableId, orphanBit);
            currentUsedBits.delete(orphanBit);
            releasedBits.push(orphanBit);
        }

        return { 
            releasedCount: releasedBits.length, 
            releasedBits 
        };
    }

    private toEntity(data: {
        id: string;
        entityType: string;
        entityTypeId: string;
        sequence: number;
        totalBits: number;
        usedBits: number[];
        status: string;
        createTime: Date;
        updateTime?: Date | null;
        deleteTime?: Date | null;
        ownedBy: string;
        name?: string;
        description?: string;
        chTableName?: string;
    }): BitmapTableEntity {
        return {
            id: data.id,
            entityType: data.entityType,
            entityTypeId: data.entityTypeId,
            sequence: data.sequence,
            totalBits: data.totalBits,
            usedBits: data.usedBits,
            status: data.status,
            createTime: data.createTime,
            updateTime: data.updateTime,
            deleteTime: data.deleteTime,
            ownedBy: (data as any).ownedBy,
            name: data.name,
            description: data.description,
            chTableName: (data as any).chTableName,
        };
    }

    private async getTagInfoForBit(bitmapTableId: string, bitPosition: number,tenantFilter?: TenantFilterOptions): Promise<{
        tagId: string | null;
        tagName: string | null;
        enumValue: string | null;
    }> {
        const params:unknown[]=[bitmapTableId,bitPosition];
        const scope=tenantFilter?.tenantId?(params.push(tenantFilter.tenantId),' AND c.owned_by=$3::uuid AND t.owned_by=$3::uuid'):'';
        const config=await tagOne<{tagId:string;tagName:string|null;enumValue:string|null}>('SELECT c.tag_id,t.name AS "tagName",c.enum_value FROM tag_storage_config c JOIN tag t ON t.id=c.tag_id WHERE c.bitmap_table_id=$1 AND c.bit_position=$2 AND c.delete_time IS NULL'+scope+' LIMIT 1',params);
        return config?{tagId:config.tagId,tagName:config.tagName||null,enumValue:config.enumValue||null}:{tagId:null,tagName:null,enumValue:null};
    }

    async cleanupTagStorageConfigs(tagId: string): Promise<void> {
        // 硬删除该标签的所有 TagStorageConfig 记录（包括软删除的）
        const count = await execute('DELETE FROM tag_storage_config WHERE tag_id=$1',[tagId]);

        if (count > 0) {
            log.info('清理残留 TagStorageConfig 记录', { tagId, count: count });
        }
    }

    async unassignAllBitsForTag(tagId: string, userId?: string): Promise<number[]> {
        const allRecords = await this.tagStorageConfigRepository.findAllByTagId(tagId);
        const releasedBits: number[] = [];

        for (const record of allRecords) {
            if (record.bitPosition == null || !record.bitmapTableId) continue;
            try {
                await transaction(async (tx) => {
                    await this.bitmapRepository.releaseBitAt(record.bitmapTableId!, record.bitPosition!, tx);
                    await this.tagStorageConfigRepository.delete(record.id, userId, tx);
                });
                releasedBits.push(record.bitPosition);
                log.info('释放 ENUM bitmap 位', { tagId, bitPosition: record.bitPosition });
            } catch (error) {
                log.warn('释放 bitmap 位失败', { tagId, bitPosition: record.bitPosition, error });
            }
        }

        return releasedBits;
    }
}
