import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';

import { TargetTableStatus } from '@/modules/tag/domain/entities/TargetTable';

import { ITargetTableRepository } from '@/modules/tag/domain/ports/ITargetTableRepository';

import { log } from '@/platform/logger';

import { config } from '@/platform/config/index';

export interface StatsResult {
  rowCount: number;
  lastModificationTime?: Date;
}

export interface TargetTableStatsService {
  syncStats(tableId: string): Promise<StatsResult | null>;
  getTableStats(tableName: string): Promise<StatsResult | null>;
}

export class TargetTableStatsServiceImpl implements TargetTableStatsService {
  constructor(
    private readonly clickHouseClient: IClickHouseClientAdapter,
    private readonly repository: ITargetTableRepository
  ) {}

  async syncStats(tableId: string): Promise<StatsResult | null> {
    const table = await this.repository.findById(tableId);
    if (!table) {
      log.warn(`TargetTable not found for stats sync: ${tableId}`);
      return null;
    }

    if (table.status === TargetTableStatus.DRAFT) {
      log.warn(`Cannot sync stats for DRAFT table: ${tableId}`);
      return null;
    }

    const stats = await this.getTableStats(table.tableName);
    
    if (stats) {
      await this.repository.updateStats(tableId, stats.rowCount, stats.lastModificationTime);
    log.info(`Synced stats for table ${table.tableName}`, { rowCount: stats.rowCount });
    }
    
    return stats;
  }

  async getTableStats(tableName: string): Promise<StatsResult | null> {
    try {
      const countResult = await this.clickHouseClient.query<{ count: number }>(
        `SELECT count() as count FROM ${this.escapeIdentifier(tableName)}`
      );

      const rowCount = countResult[0]?.count ?? 0;

      const partsResult = await this.clickHouseClient.query<{ 
        modification_time: string 
      }>(
        `SELECT 
          modification_time 
        FROM system.parts 
        WHERE table = '${tableName}' 
          AND database = currentDatabase()
          AND active = 1
        ORDER BY modification_time DESC 
        LIMIT 1`
      );

      let lastModificationTime: Date | undefined;
      if (partsResult.length > 0 && partsResult[0].modification_time) {
        lastModificationTime = new Date(partsResult[0].modification_time);
      }

      return { rowCount, lastModificationTime };
    } catch (error) {
      log.error(`Failed to get stats for table ${tableName}`, error);
      return null;
    }
  }

  private escapeIdentifier(name: string): string {
    const parts = name.split('.');
    if (parts.length > 2) {
      throw new Error(`无效的表名: ${name}`);
    }
    for (const part of parts) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
        throw new Error(`无效的标识符: ${part}`);
      }
    }
    return parts.map(p => `\`${p}\``).join('.');
  }
}

export function createTargetTableStatsService(
  clickHouseClient: IClickHouseClientAdapter,
  repository: ITargetTableRepository
): TargetTableStatsService {
  return new TargetTableStatsServiceImpl(clickHouseClient, repository);
}
