import { Tag } from '@/modules/tag/domain/entities/Tag';
import { TagVersion } from '@/modules/tag/domain/entities/TagVersion';
import { MvStep } from '@/modules/tag/domain/value-objects/MvStep';
import type { CascadeStep } from '@/modules/tag/domain/value-objects/TagCalculationRule';

/**
 * 刷新间隔枚举
 */
export enum RefreshInterval {
  REALTIME = 'TO_MODE',
  HOURLY = 'REFRESH EVERY 1 HOUR',
  DAILY = 'REFRESH EVERY 1 DAY OFFSET 2 HOUR',
  WEEKLY = 'REFRESH EVERY 7 DAY',
  MONTHLY = 'REFRESH EVERY 30 DAY',
}

/**
 * 更新周期枚举
 */
export enum UpdateCycle {
  REALTIME = 'REALTIME',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/**
 * 目标表数据（用于配置构建）
 */
export interface TargetTableData {
  id: string;
  tableName: string;
}

/**
 * MvConfig 值对象
 *
 * 封装物化视图的配置信息
 * 支持单步骤和级联 MV
 *
 * 注意: 命名为 MvConfig 以避免与 数据库 生成的 MaterializedViewConfig 类型冲突
 */
export class MvConfig {
  constructor(
    public readonly mvName: string,
    public readonly mvResultTable: string,
    public readonly refreshInterval: RefreshInterval,
    public readonly steps: MvStep[] = [],
    public readonly bitmapMvName?: string,
    public readonly bitmapTableName?: string,
  ) {}

  /**
   * 从标签和版本创建配置（使用关联的 TargetTable）
   * 
   * @param tag 标签信息
   * @param version 版本信息
   * @param targetTables 目标表映射（按 step.targetTableId 索引）
   */
  static fromTagWithTargetTables(
    tag: { id: string; updateCycle: UpdateCycle },
    version: { version: number; calculationRule: string },
    targetTables: Map<string, TargetTableData>,
    bitmapTableName?: string,
  ): MvConfig {
    const mvName = `mv_tag_${tag.id}_v${version.version}`;
    const refreshInterval = this.mapUpdateCycleToRefresh(tag.updateCycle);
    const bitmapMvName = bitmapTableName ? `${mvName}_bitmap` : undefined;

    const calculationRule = JSON.parse(version.calculationRule);

    if (calculationRule.ruleType === 'CASCADE' && calculationRule.steps?.length > 0) {
      const steps = calculationRule.steps.map((step: CascadeStep & { targetTableId?: string }, index: number) => {
        const isLast = index === calculationRule.steps.length - 1;
        
        if (!step.targetTableId || !targetTables.has(step.targetTableId)) {
          throw new Error(`CASCADE step ${index + 1} requires targetTableId but TargetTable not found in map`);
        }
        const mvResultTable = targetTables.get(step.targetTableId)!.tableName;

        const stepMvName = `${mvName}_step${index + 1}`;

        return new MvStep(
          step.order || index + 1,
          step.sql,
          mvResultTable,
          stepMvName,
          tag.id,
          version.version
        );
      });

      const mainTargetTableName = steps[steps.length - 1].mvResultTable;
      return new MvConfig(mvName, mainTargetTableName, refreshInterval, steps, bitmapMvName, bitmapTableName);
    }

    if (targetTables.size === 0) {
      throw new Error(`Tag ${tag.id} v${version.version} has no associated TargetTable. Single-step rules require TargetTable to be linked first.`);
    }
    const firstTargetTable = targetTables.values().next().value;
    if (!firstTargetTable) {
      throw new Error(`Tag ${tag.id} v${version.version}: failed to get TargetTable from map`);
    }
    const defaultTargetTableName = firstTargetTable.tableName;
    return new MvConfig(mvName, defaultTargetTableName, refreshInterval, [], bitmapMvName, bitmapTableName);
  }

  /**
   * 映射更新周期到刷新间隔
   */
  private static mapUpdateCycleToRefresh(cycle: UpdateCycle): RefreshInterval {
    const mapping: Record<UpdateCycle, RefreshInterval> = {
      [UpdateCycle.REALTIME]: RefreshInterval.REALTIME,
      [UpdateCycle.HOURLY]: RefreshInterval.HOURLY,
      [UpdateCycle.DAILY]: RefreshInterval.DAILY,
      [UpdateCycle.WEEKLY]: RefreshInterval.WEEKLY,
      [UpdateCycle.MONTHLY]: RefreshInterval.MONTHLY,
    };
    return mapping[cycle] || RefreshInterval.DAILY;
  }

  /**
   * 是否为实时模式（TO 模式，INSERT 触发）
   * 非实时模式使用 REFRESH 模式（定时重算）
   */
  get isRealtime(): boolean {
    return this.refreshInterval === RefreshInterval.REALTIME;
  }

  /**
   * 是否为级联 MV
   */
  get isCascade(): boolean {
    return this.steps.length > 0;
  }

  /**
   * 获取主 MV 名称
   */
  get mainMvName(): string {
    return this.steps.length > 0 ? this.steps[this.steps.length - 1].mvName : this.mvName;
  }

  /**
   * 获取所有 MV 名称
   */
  get allMvNames(): string[] {
    const names = this.steps.length === 0
      ? [this.mvName]
      : this.steps.map((s) => s.mvName);
    if (this.bitmapMvName) {
      names.push(this.bitmapMvName);
    }
    return names;
  }

  /**
   * 获取所有目标表名称
   */
  get allMvResultTables(): string[] {
    if (this.steps.length === 0) {
      return [this.mvResultTable];
    }
    return this.steps.map((s) => s.stepResultTable);
  }
}

