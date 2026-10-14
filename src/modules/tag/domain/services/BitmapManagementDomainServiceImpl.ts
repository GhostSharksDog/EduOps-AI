import { IBitmapManagementDomainService, BitAllocationResult, MultiBitAllocationResult, BitmapTableData } from '@/modules/tag/domain/services/ports/IBitmapManagementDomainService';
import { IBitmapTableRepository } from '@/modules/tag/domain/ports/IBitmapTableRepository';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { BitmapTable } from '@/modules/tag/domain/entities/BitmapTable';
import { log } from '@/platform/logger';
import { randomUUID } from 'crypto';
import { config } from '@/platform/config/index';

export class BitmapManagementDomainServiceImpl implements IBitmapManagementDomainService {
  constructor(
    private readonly bitmapTableRepository: IBitmapTableRepository,
    private readonly chClient: IClickHouseClientAdapter
  ) {}

  async allocateBit(entityTypeId: string, entityType: string, tenantId?: string): Promise<BitAllocationResult> {
    const bitmapTableData = await this.getOrCreateBitmapTable(entityTypeId, entityType, tenantId);
    const bitmapTable = BitmapTable.fromData(bitmapTableData);

    if (!bitmapTable.hasAvailableBit()) {
      throw new Error(
        `Bitmap 表 ${bitmapTable.id} 已无可用位，` +
          `entityTypeId: ${entityTypeId}，请联系管理员创建新的 Bitmap 表`
      );
    }

    const bitPosition = bitmapTable.allocateBit();
    if (bitPosition === null) {
      throw new Error(`分配位失败: ${bitmapTable.id}`);
    }

    await this.bitmapTableRepository.update(bitmapTable.toData());

    log.info('Bitmap 位分配成功', {
      entityTypeId,
      entityType,
      bitmapTableId: bitmapTable.id,
      bitPosition,
      remainingBits: bitmapTable.getAvailableBitCount(),
    });

    return {
      bitPosition,
      bitmapTableId: bitmapTable.id,
      bitmapTableName: bitmapTableData.chTableName ?? '',
      entityTypeId,
      entityType,
    };
  }

  async allocateBits(entityTypeId: string, entityType: string, count: number, tenantId?: string): Promise<MultiBitAllocationResult> {
    const bitmapTableData = await this.getOrCreateBitmapTable(entityTypeId, entityType, tenantId);
    const bitmapTable = BitmapTable.fromData(bitmapTableData);

    if (!bitmapTable.hasAvailableBit()) {
      throw new Error(
        `Bitmap 表 ${bitmapTable.id} 已无可用位 (需要 ${count} 个)`
      );
    }
    if (bitmapTable.getAvailableBitCount() < count) {
      throw new Error(
        `Bitmap 表 ${bitmapTable.id} 可用位不足 (需要 ${count}, 剩余 ${bitmapTable.getAvailableBitCount()})`
      );
    }

    const positions: number[] = [];
    for (let i = 0; i < count; i++) {
      const pos = bitmapTable.allocateBit();
      if (pos === null) {
        // 回滚已分配的位
        for (const p of positions) {
          bitmapTable.releaseBit(p);
        }
        throw new Error(`分配第 ${i + 1} 个位时失败`);
      }
      positions.push(pos);
    }

    await this.bitmapTableRepository.update(bitmapTable.toData());

    log.info('Bitmap 多位分配成功', {
      entityTypeId,
      entityType,
      bitmapTableId: bitmapTable.id,
      positions,
      count,
      remainingBits: bitmapTable.getAvailableBitCount(),
    });

    return {
      positions,
      bitmapTableId: bitmapTable.id,
      bitmapTableName: bitmapTableData.chTableName ?? '',
      entityTypeId,
      entityType,
    };
  }

  async releaseBit(bitmapTableId: string, bitPosition: number): Promise<void> {
    const bitmapTableData = await this.bitmapTableRepository.findById(bitmapTableId);
    if (!bitmapTableData) {
      throw new Error(`Bitmap 表不存在: ${bitmapTableId}`);
    }

    const bitmapTable = BitmapTable.fromData(bitmapTableData);

    if (!bitmapTable.isBitUsed(bitPosition)) {
      log.warn('位未被占用，跳过释放', { bitmapTableId, bitPosition });
      return;
    }

    bitmapTable.releaseBit(bitPosition);
    await this.bitmapTableRepository.update(bitmapTable.toData());

    log.info('Bitmap 位释放成功', {
      bitmapTableId,
      bitPosition,
      usedBits: bitmapTable.usedBits,
    });
  }

  async getOrCreateBitmapTable(entityTypeId: string, entityType: string, tenantId?: string): Promise<BitmapTableData> {
    const tenantFilter={tenantId:tenantId??config.system.userId};
    const existing = await this.bitmapTableRepository.findActiveByEntityTypeId(entityTypeId,tenantFilter);
    if (existing) {
      return existing;
    }

    const allTables = (await this.bitmapTableRepository.findByEntityTypeId(entityTypeId,false,tenantFilter)).filter(table=>table.ownedBy===tenantFilter.tenantId);
    const maxSequence = allTables.reduce((max, t) => Math.max(max, t.sequence), 0);
    const nextSequence = maxSequence + 1;

    const tableName = this.generateBitmapTableName(entityTypeId, nextSequence);
    await this.checkTableNameCollision(tableName);

    const newTable: BitmapTableData = {
      id: randomUUID(),
      entityTypeId,
      entityType,
      sequence: nextSequence,
      totalBits: 64,
      usedBits: [],
      status: 'ACTIVE',
      createTime: new Date(),
      ownedBy: tenantId ?? config.system.userId,
      chTableName: tableName,
    };

    try {
      await this.createBitmapTableInCH(tableName);
    } catch (chError) {
      log.error('ClickHouse Bitmap 表创建失败，回滚 PG 记录', {
        entityTypeId,
        sequence: nextSequence,
        tableName,
        error: chError,
      });
      throw new Error(`ClickHouse 表创建失败: ${chError instanceof Error ? chError.message : String(chError)}`);
    }

    try {
      await this.bitmapTableRepository.create(newTable);
    } catch (pgError) {
      log.error('PG Bitmap 表记录创建失败，尝试清理 CH 表', {
        entityTypeId,
        sequence: nextSequence,
        tableName,
        error: pgError,
      });
      
      try {
        await this.chClient.dropTable(tableName);
        log.info('CH 表已清理', { tableName });
      } catch (cleanupError) {
        log.error('CH 表清理失败，需要手动干预', {
          entityTypeId,
          sequence: nextSequence,
          tableName,
          error: cleanupError,
          action: '请手动执行: DROP TABLE IF EXISTS ' + tableName,
        });
      }
      
      throw pgError;
    }

    log.info('Bitmap 表配置创建成功', {
      entityTypeId,
      entityType,
      bitmapTableId: newTable.id,
      sequence: nextSequence,
      tableName,
    });

    return newTable;
  }

  async findActiveByEntityTypeId(entityTypeId: string): Promise<BitmapTableData | null> {
    return this.bitmapTableRepository.findActiveByEntityTypeId(entityTypeId);
  }

  async getBitmapTable(bitmapTableId: string): Promise<BitmapTableData | null> {
    return this.bitmapTableRepository.findById(bitmapTableId);
  }

  async resetBitmapBit(bitmapTableId: string, bitPosition: number): Promise<void> {
    const bitmapTableData = await this.bitmapTableRepository.findById(bitmapTableId);
    if (!bitmapTableData) {
      throw new Error(`Bitmap 表不存在: ${bitmapTableId}`);
    }

    const tableName = bitmapTableData.chTableName;
    if (!tableName) {
      throw new Error(`Bitmap 表 ${bitmapTableId} 缺少 chTableName，无法重置位`);
    }

    await this.chClient.resetBitmapBit(tableName, bitPosition);

    log.info('Bitmap 位重置成功', {
      bitmapTableId,
      bitPosition,
      tableName,
    });
  }

  async checkBitAvailable(bitmapTableId: string, bitPosition: number): Promise<boolean> {
    const bitmapTableData = await this.bitmapTableRepository.findById(bitmapTableId);
    if (!bitmapTableData) {
      return false;
    }

    const bitmapTable = BitmapTable.fromData(bitmapTableData);
    return bitmapTable.isValidBitPosition(bitPosition) && !bitmapTable.isBitUsed(bitPosition);
  }

  private generateBitmapTableName(entityTypeId: string, sequence: number): string {
    const shortId = entityTypeId.replace(/-/g, '').substring(0, 8);
    const randomSuffix = randomUUID().split('-')[0].substring(0, 6);
    const timestamp = Date.now().toString(36).substring(-4);
    return `tag_bitmap_${shortId}_${sequence}_${randomSuffix}_${timestamp}`;
  }

  private async checkTableNameCollision(tableName: string): Promise<void> {
    try {
      const result = await this.chClient.execute(
        `SELECT count() as cnt FROM system.tables WHERE name = '${tableName}'`
      ) as unknown as { cnt: number }[];
      const exists = Array.isArray(result) && result.length > 0 && result[0]?.cnt > 0;
      if (exists) {
        throw new Error(
          `ClickHouse 表名碰撞: ${tableName} 已存在。` +
          `这可能是由于 entityTypeId 前 8 位重复导致的。` +
          `建议使用完整 UUID 作为表名或联系管理员处理。`
        );
      }
      log.debug('表名碰撞检测完成', { tableName, exists: false });
    } catch (error) {
      if (error instanceof Error && error.message.includes('表名碰撞')) {
        throw error;
      }
    }
  }

  private async createBitmapTableInCH(tableName: string): Promise<void> {
    const quoted = tableName.includes('.') ? tableName.split('.').map(p => `\`${p}\``).join('.') : `\`${tableName}\``;
    const sql = `
      CREATE TABLE IF NOT EXISTS ${quoted} (
        entity_id String,
        bitmap_col SimpleAggregateFunction(groupBitOr, UInt64)
      )
      ENGINE = AggregatingMergeTree()
      ORDER BY entity_id
    `;

    await this.chClient.createTable(sql);

    log.info('ClickHouse Bitmap 表创建成功', { tableName });
  }
}
