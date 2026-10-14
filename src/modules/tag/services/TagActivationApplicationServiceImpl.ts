import {
  ITagActivationApplicationService,
  ActivateTagCommand,
  DeactivateTagCommand,
  ResumeTagCommand,
  DeleteTagCommand,
  UpdateTagRuleCommand,
  UpdateTagCycleCommand,
  ActivateTagResult,
  DeprecateTagCommand,
  RebuildMvCommand,
  RebuildMvResult,
} from '@/modules/tag/services/TagActivationApplicationService';
import { TagDomainService } from '@/modules/tag/domain/services/ports/TagDomainService';
import { IMaterializedViewDomainService } from '@/modules/tag/domain/services/ports/IMaterializedViewDomainService';
import { IBitmapManagementDomainService } from '@/modules/tag/domain/services/ports/IBitmapManagementDomainService';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { IBitmapApplicationService } from '@/modules/tag/services/bitmap/IBitmapApplicationService';
import { ITagBitmapSyncDomainService } from '@/modules/tag/domain/services/ports/ITagBitmapSyncDomainService';
import { MvConfig, UpdateCycle, TargetTableData } from '@/modules/tag/domain/value-objects/MaterializedViewConfig';
import { RuleType } from '@/shared/enums/tag/RuleType';
import { TagStatus } from '@/shared/enums/index';
import { TagValueType } from '@/shared/enums/tag/TagValueType';
import { log } from '@/platform/logger';
import { randomUUID } from 'crypto';
import { IMaterializedViewConfigRepository } from '@/modules/tag/domain/ports/IMaterializedViewConfigRepository';
import { ITargetTableRepository, TargetTableData as FullTargetTableData } from '@/modules/tag/domain/ports/ITargetTableRepository';
import type { CascadeStep } from '@/modules/tag/domain/value-objects/TagCalculationRule';

export class TagActivationApplicationServiceImpl implements ITagActivationApplicationService {
  constructor(
    private readonly tagDomainService: TagDomainService,
    private readonly mvDomainService: IMaterializedViewDomainService,
    private readonly bitmapManagementService: IBitmapManagementDomainService,
    private readonly chClient: IClickHouseClientAdapter,
    private readonly bitmapApplicationService: IBitmapApplicationService,
    private readonly bitmapSyncService: ITagBitmapSyncDomainService,
    private readonly mvConfigRepository: IMaterializedViewConfigRepository,
    private readonly targetTableRepository: ITargetTableRepository
  ) {}

  async activateTag(command: ActivateTagCommand): Promise<ActivateTagResult> {
    const { tagId, userId } = command;

    try {
      const tag = await this.tagDomainService.getTag(tagId);
      if (!tag) {
        return new ActivateTagResult(false, [], [], undefined, undefined, `标签不存在: ${tagId}`);
      }

      if (tag.status === TagStatus.ACTIVE) {
        return new ActivateTagResult(false, [], [], undefined, undefined, '标签已是激活状态');
      }

      const version = tag.currentVersion;
      if (!version) {
        return new ActivateTagResult(false, [], [], undefined, undefined, '标签没有当前版本');
      }

      // 根据值类型分支处理 bitmap 分配
      const valueType = tag.dataType as TagValueType;
      const versionEnumValues: string[] = Array.isArray(version.enumValues) ? (version.enumValues as unknown as string[]) : [];
      
      log.info('activateTag 诊断', { 
        tagId, 
        valueType, 
        enumValuesRaw: version.enumValues,
        versionEnumValues,
        versionEnumValuesLength: versionEnumValues.length,
      });
      
      // ENUM 专用数据
      let enumBitPositions: number[] = [];
      let enumValuesForMv: string[] = [];
      
      let bitAssignment: {
        bitPosition?: number | null;
        bitmapTableName: string;
        bitmapTableId: string;
      } | null = null;

      if (valueType === TagValueType.ENUM && versionEnumValues.length > 0) {
        // ENUM：需要 target tables 来获取 entity type
        const parsedRuleForTarget = typeof version.calculationRule === 'string'
          ? JSON.parse(version.calculationRule)
          : ((version.calculationRule as unknown) as Record<string, unknown>) ?? {};
        const targetTablesForEnum = await this.buildTargetTableMap(tag.id, parsedRuleForTarget);
        
        // 从 target tables 获取 entity type
        const firstTargetTable = targetTablesForEnum.values().next().value;
        if (!firstTargetTable) {
          return new ActivateTagResult(false, [], [], undefined, undefined, 'ENUM 标签未关联目标表');
        }

        const fullTargetTable = await this.targetTableRepository.findById(firstTargetTable.id);
        const entityTypeId = fullTargetTable?.entityTypeId;
        const entityType = fullTargetTable?.entityType || '';
        if (!entityTypeId) {
          return new ActivateTagResult(false, [], [], undefined, undefined, '无法获取实体类型 ID');
        }

        // 清理前次失败激活的残留 TagStorageConfig 记录
        await this.bitmapApplicationService.cleanupTagStorageConfigs(tagId);

        const multiBit = await this.bitmapManagementService.allocateBits(
          entityTypeId,
          entityType,
          versionEnumValues.length,
          tag.ownedBy
        );

        try {
          // 为每个枚举值注册 TagStorageConfig
          for (let i = 0; i < versionEnumValues.length; i++) {
            await this.bitmapApplicationService.assignBitToTag(
              multiBit.bitmapTableId,
              multiBit.positions[i],
              tagId,
              userId,
              undefined,
              versionEnumValues[i],
              true  // skipAssignBit: allocateBits 已分配，避免冲突
            );
          }
        } catch (assignError) {
          // 分配失败时释放已分配的 bit
          log.error('ENUM bit 注册失败，回滚已分配的 bit', { tagId, positions: multiBit.positions, error: assignError });
          for (const pos of multiBit.positions) {
            try {
              await this.bitmapManagementService.releaseBit(multiBit.bitmapTableId, pos);
            } catch { /* 忽略回滚失败 */ }
          }
          throw assignError;
        }
        
        bitAssignment = {
          bitmapTableName: multiBit.bitmapTableName,
          bitmapTableId: multiBit.bitmapTableId,
        };
        enumBitPositions = multiBit.positions;
        enumValuesForMv = versionEnumValues;
      } else {
        // BOOLEAN / NUMBER / DATE / DATETIME / STRING：必须已有分配
        const bitAssign = await this.bitmapApplicationService.getTagBitAssignment(tagId);
        if (!bitAssign) {
          return new ActivateTagResult(
            false, [], [], undefined, undefined,
            '标签未分配 Bit 位置，请先在 Bitmap 管理页面分配'
          );
        }
        bitAssignment = bitAssign;
      }

      const parsedRule = typeof version.calculationRule === 'string' 
        ? JSON.parse(version.calculationRule) 
        : ((version.calculationRule as unknown) as Record<string, unknown>) ?? {};
      const targetTables = await this.buildTargetTableMap(tag.id, parsedRule);

      const mvConfig = MvConfig.fromTagWithTargetTables(
        {
          id: tag.id,
          updateCycle: tag.updateCycle as unknown as UpdateCycle,
        },
        {
          version: version.version,
          calculationRule: version.calculationRule ?? '{}',
        },
        targetTables,
        bitAssignment.bitmapTableName,
      );

      const mvNames: string[] = [];
      const tableNames: string[] = [];

      try {
        const sql = this.extractSql(version.calculationRule ?? '');
        let mvName = mvConfig.mvName;
        let mvResultTable = mvConfig.mvResultTable;

        if (this.isFullCreateStatement(sql)) {
          const actualMvName = this.extractMvNameFromSql(sql);
          if (actualMvName) {
            mvName = actualMvName;
            mvResultTable = this.extractTargetTableFromSql(sql) || mvResultTable;
          }
          if (actualMvName && await this.chClient.checkTableExists(actualMvName)) {
            log.info('MV 已存在，跳过创建', { tagId, actualMvName });
          } else {
            await this.mvDomainService.createMv(mvConfig, sql);
          }
        } else {
          const mvExists = await this.chClient.checkTableExists(mvConfig.mvName);
          if (mvExists) {
            // 检查 MV 的目标表是否与当前关联的目标表一致
            const currentTarget = await this.chClient.getMvTargetTable(mvConfig.mvName);
            if (currentTarget && currentTarget !== mvConfig.mvResultTable) {
              log.info('MV目标表已变更，重建MV', { tagId, oldTarget: currentTarget, newTarget: mvConfig.mvResultTable });
              await this.chClient.dropMaterializedView(mvConfig.mvName);
              await this.mvDomainService.createMv(mvConfig, sql);
            } else {
              log.info('MV 已存在，恢复物化视图', { tagId, mvName: mvConfig.mvName });
              await this.mvDomainService.startMv(mvConfig.allMvNames);
            }
          } else {
            await this.mvDomainService.createMv(mvConfig, sql);
          }
        }

        // 统一写入 MV 配置到 PG
        try {
          await this.mvConfigRepository.deleteByTagId(tagId);
          await this.mvConfigRepository.create({
            id: randomUUID(),
            tagId: tag.id,
            versionId: tag.currentVersionId!,
            mvName,
            mvResultTable,
            refreshInterval: mvConfig.refreshInterval,
            ownedBy: tag.ownedBy,
            stepOrder: 1,
            isCascade: false,
            createTime: new Date(),
          });
          log.info('MV配置已写入PG', { tagId, mvName, mvResultTable });
        } catch (error) {
          log.error('写入MV配置失败', { tagId, error });
        }

        mvNames.push(...mvConfig.allMvNames);
        tableNames.push(...mvConfig.allMvResultTables);

        // 创建 bitmap MV
        const bitmapSql = this.extractSql(version.calculationRule ?? '');
        
        if (valueType === TagValueType.ENUM && enumBitPositions.length > 0) {
          // ENUM：创建独立 ReplacingMergeTree bitmap 表 + 单一 MV（multiIf 互斥）
          const enumBitmapTableName = bitAssignment!.bitmapTableName + '_enum';
          const enumMvName = `${mvConfig.mvName}_enum_bitmap`;
          const enumBitMapping = enumValuesForMv.map((val, i) => ({
            value: val,
            bitPosition: enumBitPositions[i],
          }));

          try {
            // 1. 创建 ENUM bitmap 表（ReplacingMergeTree，新值覆盖旧值）
            await this.chClient.createEnumBitmapTable(enumBitmapTableName);
            tableNames.push(enumBitmapTableName);
            log.info('ENUM bitmap 表创建成功', { tagId, enumBitmapTableName });

            // 2. 创建单一 ENUM bitmap MV（multiIf 映射，天然互斥）
            await this.chClient.createEnumBitmapMaterializedView(
              enumMvName,
              enumBitmapTableName,
              bitmapSql,
              enumBitMapping,
              mvConfig.refreshInterval,
              mvConfig.isRealtime,
            );
            mvNames.push(enumMvName);
            log.info('ENUM Bitmap MV 创建成功', { tagId, mvName: enumMvName, mapping: enumBitMapping });
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            log.error('ENUM Bitmap MV 创建失败，不影响标签激活', { tagId, errMsg });
          }
        } else if (mvConfig.bitmapMvName && mvConfig.bitmapTableName && bitAssignment?.bitPosition != null) {
          // BOOLEAN / NUMBER / DATE / DATETIME / STRING：单个 bitmap MV
          let whereClause = 'tag_value != 0';
          if (valueType !== TagValueType.BOOLEAN) {
            whereClause = 'tag_value IS NOT NULL';
          }
          try {
            await this.chClient.createBitmapMaterializedView(
              mvConfig.bitmapMvName,
              mvConfig.bitmapTableName,
              bitmapSql,
              bitAssignment.bitPosition,
              whereClause
            );
            mvNames.push(mvConfig.bitmapMvName);
            log.info('Bitmap MV 创建成功', { tagId, bitmapMvName: mvConfig.bitmapMvName, whereClause });
          } catch (error) {
            log.error('Bitmap MV 创建失败，不影响标签激活', { tagId, error });
          }
        }

        await this.tagDomainService.updateTagStatus(tagId, TagStatus.ACTIVE);

        log.info('标签激活成功', { tagId, mvNames, tableNames });

        // 非阻塞：创建同步状态，失败不影响激活
        try {
          await this.bitmapSyncService.createSyncState({
            tagId: tag.id,
            tagVersion: tag.currentVersionId!,
            ownedBy: tag.ownedBy,
          });
        } catch (error) {
          // 同步状态创建失败不应导致激活回滚
          log.error('创建 Bitmap 同步状态失败，将由定时任务补偿', { tagId: tag.id, error });
        }

        return new ActivateTagResult(
          true,
          mvNames,
          tableNames,
          bitAssignment.bitPosition ?? undefined,
          bitAssignment.bitmapTableId
        );
      } catch (error) {
        await this.rollbackActivation(mvConfig);

        const errorMsg = error instanceof Error ? error.message : '激活失败';
        log.error('标签激活失败', { tagId, error: errorMsg });

        return new ActivateTagResult(false, [], [], undefined, undefined, errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '激活失败';
      log.error('标签激活异常', { tagId, error: errorMsg });
      return new ActivateTagResult(false, [], [], undefined, undefined, errorMsg);
    }
  }

  async deactivateTag(command: DeactivateTagCommand): Promise<void> {
    const { tagId, releaseBit, userId } = command;

    const tag = await this.tagDomainService.getTag(tagId);
    if (!tag || !tag.currentVersion) {
      throw new Error(`标签或版本不存在: ${tagId}`);
    }

    // Step 1: Update status to INACTIVE FIRST (required for unassignBit to succeed)
    await this.tagDomainService.updateTagStatus(tagId, TagStatus.INACTIVE);

    // Step 2: Release bitmap bit if requested (now safe since tag is INACTIVE)
    if (releaseBit) {
      if (tag.dataType === TagValueType.ENUM) {
        // ENUM 标签：释放所有 bit（N 个枚举值 = N 个 bit）
        const releasedBits = await this.bitmapApplicationService.unassignAllBitsForTag(tagId, userId);
        if (releasedBits.length > 0) {
          log.info('停用时释放 ENUM bitmap 位', { tagId, releasedBits });
        }
      } else {
        // 非 ENUM 标签：释放单个 bit
        const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tagId);
        if (bitAssignment) {
          try {
            await this.bitmapApplicationService.unassignBit(
              bitAssignment.bitmapTableId,
              bitAssignment.bitPosition!,
              userId
            );
            log.info('停用时释放bitmap位', { tagId, bitPosition: bitAssignment.bitPosition });
          } catch (error) {
            log.warn('释放bitmap位失败', { tagId, error });
          }
        }
      }
    }

    const parsedRule = typeof tag.currentVersion.calculationRule === 'string'
        ? JSON.parse(tag.currentVersion.calculationRule)
        : ((tag.currentVersion.calculationRule as unknown) as Record<string, unknown>) ?? {};
    const targetTables = await this.buildTargetTableMap(tag.id, parsedRule);

    const bitmapTableName = await this.getBitmapTableName(tagId);
    const mvConfig = MvConfig.fromTagWithTargetTables(
      {
        id: tag.id,
        updateCycle: tag.updateCycle as unknown as UpdateCycle,
      },
      {
        version: tag.currentVersion.version,
        calculationRule: tag.currentVersion.calculationRule ?? '{}',
      },
      targetTables,
      bitmapTableName,
    );

    await this.mvDomainService.stopMv(mvConfig.allMvNames);

    // 停用 ENUM bitmap MVs
    if (tag.dataType === TagValueType.ENUM && tag.currentVersion?.enumValues?.length) {
      await this.stopEnumBitmapMvs(tagId, tag.currentVersion.version, tag.currentVersion.enumValues);
    }

    log.info('标签已停用', { tagId, releaseBit });
  }

  async resumeTag(command: ResumeTagCommand): Promise<void> {
    const { tagId } = command;

    const tag = await this.tagDomainService.getTag(tagId);
    if (!tag || !tag.currentVersion) {
      throw new Error(`标签或版本不存在: ${tagId}`);
    }

    const parsedRule = typeof tag.currentVersion.calculationRule === 'string'
        ? JSON.parse(tag.currentVersion.calculationRule)
        : ((tag.currentVersion.calculationRule as unknown) as Record<string, unknown>) ?? {};
    const targetTables = await this.buildTargetTableMap(tag.id, parsedRule);
    const bitmapTableName = await this.getBitmapTableName(tagId);

    const mvConfig = MvConfig.fromTagWithTargetTables(
      {
        id: tag.id,
        updateCycle: tag.updateCycle as unknown as UpdateCycle,
      },
      {
        version: tag.currentVersion.version,
        calculationRule: tag.currentVersion.calculationRule ?? '{}',
      },
      targetTables,
      bitmapTableName,
    );

    await this.mvDomainService.startMv(mvConfig.allMvNames);

    // 启动 ENUM bitmap MVs
    if (tag.dataType === TagValueType.ENUM && tag.currentVersion?.enumValues?.length) {
      await this.startEnumBitmapMvs(tagId, tag.currentVersion.version, tag.currentVersion.enumValues);
    }

    await this.tagDomainService.updateTagStatus(tagId, TagStatus.ACTIVE);

    log.info('标签已恢复', { tagId });
  }

  async deleteTag(command: DeleteTagCommand): Promise<void> {
    const { tagId, userId } = command;

    const tag = await this.tagDomainService.getTag(tagId);
    if (!tag) {
      throw new Error(`标签不存在: ${tagId}`);
    }

    if (tag.status !== TagStatus.DRAFT && tag.status !== TagStatus.INACTIVE && tag.status !== TagStatus.DEPRECATED) {
      throw new Error('标签必须处于草稿、非活跃或已废弃状态才能删除');
    }

    // 停止 MV（不删除），保留 CH 对象以便回收站恢复
    if (tag.currentVersion && tag.status !== TagStatus.DRAFT) {
      const parsedRule = typeof tag.currentVersion.calculationRule === 'string'
        ? JSON.parse(tag.currentVersion.calculationRule)
        : ((tag.currentVersion.calculationRule as unknown) as Record<string, unknown>) ?? {};
      const targetTables = await this.buildTargetTableMap(tag.id, parsedRule);
      const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tagId);

      const mvConfig = MvConfig.fromTagWithTargetTables(
        {
          id: tag.id,
          updateCycle: tag.updateCycle as unknown as UpdateCycle,
        },
        {
          version: tag.currentVersion.version,
          calculationRule: tag.currentVersion.calculationRule ?? '{}',
        },
        targetTables,
        bitAssignment?.bitmapTableName,
      );

      await this.mvDomainService.stopMv(mvConfig.allMvNames);
    }

    // 软删除：只标记 is_deleted，不删子记录和 CH 对象
    await this.tagDomainService.deleteTag(tagId, userId);

    log.info('标签已软删除', { tagId });
  }

  async deprecateTag(command: DeprecateTagCommand): Promise<void> {
    const { tagId, userId } = command;

    const tag = await this.tagDomainService.getTag(tagId);
    if (!tag) {
      throw new Error(`标签不存在: ${tagId}`);
    }
    if (!tag.currentVersion) {
      throw new Error(`标签或版本不存在: ${tagId}`);
    }

    // Step 1: Update status to DEPRECATED FIRST (required for unassignBit to succeed)
    await this.tagDomainService.updateTagStatus(tagId, TagStatus.DEPRECATED);

    // Step 2: Release bitmap bits
    if (tag.dataType === TagValueType.ENUM) {
      const releasedBits = await this.bitmapApplicationService.unassignAllBitsForTag(tagId, userId);
      if (releasedBits.length > 0) {
        log.info('废弃时释放 ENUM bitmap 位', { tagId, releasedBits });
      }
    } else {
      const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tagId);
      if (bitAssignment) {
        try {
          await this.bitmapApplicationService.unassignBit(
            bitAssignment.bitmapTableId,
            bitAssignment.bitPosition!,
            userId
          );
          log.info('废弃时释放 bitmap 位', { tagId, bitPosition: bitAssignment.bitPosition });
        } catch (error) {
          log.warn('废弃时释放 bitmap 位失败', { tagId, error });
        }
      }
    }

    // Step 3: Stop MVs
    const parsedRule = typeof tag.currentVersion.calculationRule === 'string'
      ? JSON.parse(tag.currentVersion.calculationRule)
      : ((tag.currentVersion.calculationRule as unknown) as Record<string, unknown>) ?? {};
    const targetTables = await this.buildTargetTableMap(tag.id, parsedRule);
    const bitmapTableName = await this.getBitmapTableName(tagId);

    const mvConfig = MvConfig.fromTagWithTargetTables(
      { id: tag.id, updateCycle: tag.updateCycle as unknown as UpdateCycle },
      { version: tag.currentVersion.version, calculationRule: tag.currentVersion.calculationRule ?? '{}' },
      targetTables,
      bitmapTableName,
    );

    await this.mvDomainService.stopMv(mvConfig.allMvNames);

    // Stop ENUM bitmap MVs
    if (tag.dataType === TagValueType.ENUM && tag.currentVersion?.enumValues?.length) {
      await this.stopEnumBitmapMvs(tagId, tag.currentVersion.version, tag.currentVersion.enumValues);
    }

    log.info('标签已废弃', { tagId, userId, reason: command.reason });
  }

  async updateTagRule(command: UpdateTagRuleCommand): Promise<void> {
    const { tagId, rule, userId } = command;

    const tag = await this.tagDomainService.getTag(tagId);
    if (!tag) {
      throw new Error(`标签不存在: ${tagId}`);
    }

    // 前置状态校验：ACTIVE 状态禁止切换版本
    if (tag.status === TagStatus.ACTIVE) {
      throw new Error('标签处于活跃状态，请先停用后再修改规则');
    }

    const oldVersion = tag.currentVersion;
    const isNewVersion = !oldVersion;

    // 创建新版本，保留旧版本的 enumValues
    const newVersion = await this.tagDomainService.createTagVersion({
      tagId,
      version: isNewVersion ? 1 : oldVersion!.version + 1,
      rule: {
        ruleType: rule.ruleType as RuleType,
        ruleContent: rule.ruleContent || '',
        dataModelIds: rule.dataModelIds || [],
      },
      enumValues: !isNewVersion && oldVersion?.enumValues
        ? (oldVersion.enumValues as unknown as string[]) : undefined,
      createdBy: userId,
    });

    // 设为当前版本
    await this.tagDomainService.setCurrentVersion(tagId, newVersion.id);

    // 把新版本 ID 写回关联的目标表
    if (!isNewVersion) {
      try {
        const targetTable = await this.targetTableRepository.findByTagId(tagId);
        if (targetTable && targetTable.tagVersionId !== newVersion.id) {
          await this.targetTableRepository.linkTag(targetTable.id, tagId, newVersion.id);
        }
      } catch (error) {
        log.warn('切换版本时更新目标表 tag_version_id 失败', { tagId, error });
      }
    }

    // 清理旧版本的 MV（标签处于非 ACTIVE 状态，MV 应已停止，但需删除旧版本的对象）
    if (!isNewVersion && oldVersion) {
      const bitmapTableName = await this.getBitmapTableName(tagId);
      const oldVersionNumber = oldVersion.version;

      // 删除旧版本主 MV + bitmap MV
      try {
        const oldParsedRule = typeof oldVersion.calculationRule === 'string'
          ? JSON.parse(oldVersion.calculationRule)
          : ((oldVersion.calculationRule as unknown) as Record<string, unknown>) ?? {};
        const oldTargetTables = await this.buildTargetTableMap(tag.id, oldParsedRule);

        if (oldTargetTables.size > 0) {
          const oldConfig = MvConfig.fromTagWithTargetTables(
            { id: tag.id, updateCycle: tag.updateCycle as unknown as UpdateCycle },
            { version: oldVersionNumber, calculationRule: oldVersion.calculationRule ?? '{}' },
            oldTargetTables,
            bitmapTableName,
          );
          await this.mvDomainService.deleteMv(oldConfig);
        } else {
          // 即使找不到目标表，也要按命名规则尝试删除旧 MV
          const oldMvName = `mv_tag_${tag.id}_v${oldVersionNumber}`;
          for (const name of [oldMvName, `${oldMvName}_bitmap`]) {
            try {
              await this.chClient.dropMaterializedView(name);
              log.info('按命名规则删除旧 MV', { tagId, mvName: name });
            } catch { /* 可能不存在 */ }
          }
        }
      } catch (error) {
        log.warn('清理旧版本主 MV 失败', { tagId, oldVersionNumber, error });
      }

      // 删除旧版本 ENUM bitmap MV + ENUM bitmap 表
      if (tag.dataType === TagValueType.ENUM && oldVersion.enumValues?.length) {
        try {
          await this.dropEnumBitmapMvs(tagId, oldVersionNumber, bitmapTableName);
        } catch (error) {
          log.warn('清理旧版本 ENUM bitmap MV 失败', { tagId, oldVersionNumber, error });
        }
      }

      // 始终清理旧的 MV 配置记录（避免监控显示错误版本）
      try {
        await this.mvConfigRepository.deleteByTagId(tagId);
      } catch (error) {
        log.warn('清理旧 MV 配置记录失败', { tagId, error });
      }
    }

    log.info('标签规则已更新（MV 将在激活时创建）', { tagId, newVersion: newVersion.version, isNewVersion });
  }

  async updateTagCycle(command: UpdateTagCycleCommand): Promise<void> {
    const { tagId, cycle } = command;

    const tag = await this.tagDomainService.getTag(tagId);
    if (!tag || !tag.currentVersion) {
      throw new Error(`标签或版本不存在: ${tagId}`);
    }

    const oldParsedRule = typeof tag.currentVersion.calculationRule === 'string'
      ? JSON.parse(tag.currentVersion.calculationRule)
      : ((tag.currentVersion.calculationRule as unknown) as Record<string, unknown>) ?? {};
    const oldTargetTables = await this.buildTargetTableMap(tag.id, oldParsedRule);
    const bitmapTableName = await this.getBitmapTableName(tagId);

    const oldConfig = MvConfig.fromTagWithTargetTables(
      {
        id: tag.id,
        updateCycle: tag.updateCycle as unknown as UpdateCycle,
      },
      {
        version: tag.currentVersion.version,
        calculationRule: tag.currentVersion.calculationRule ?? '{}',
      },
      oldTargetTables,
      bitmapTableName,
    );
    await this.mvDomainService.deleteMv(oldConfig);

    // 删除旧 ENUM bitmap MVs
    if (tag.dataType === TagValueType.ENUM && tag.currentVersion?.enumValues?.length) {
      const btName = await this.getBitmapTableName(tagId);
      await this.dropEnumBitmapMvs(tagId, tag.currentVersion.version, btName);
    }

    const updateCycle = this.parseUpdateCycle(cycle);
    tag.updateInfo(tag.name, tag.description, updateCycle);
    await this.tagDomainService.updateTag({
      tagId: tag.id,
      name: tag.name,
      description: tag.description,
      updateCycle,
      updatedBy: tag.updatedBy ?? '',
    });

    const newTargetTables = await this.buildTargetTableMap(tag.id, oldParsedRule);

    const newConfig = MvConfig.fromTagWithTargetTables(
      {
        id: tag.id,
        updateCycle,
      },
      {
        version: tag.currentVersion.version,
        calculationRule: tag.currentVersion.calculationRule ?? '{}',
      },
      newTargetTables,
      bitmapTableName,
    );

    const sql = this.extractSql(tag.currentVersion.calculationRule ?? '');
    await this.mvDomainService.createMv(newConfig, sql);

    // 重建 bitmap MV
    if (newConfig.bitmapMvName && newConfig.bitmapTableName) {
      const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tagId);
      if (bitAssignment?.bitPosition != null) {
        try {
          await this.chClient.createBitmapMaterializedView(
            newConfig.bitmapMvName,
            newConfig.bitmapTableName,
            sql,
            bitAssignment.bitPosition,
          );
        } catch (error) {
          log.warn('重建 bitmap MV 失败', { tagId, error });
        }
      }
    }

    log.info('标签周期已更新', { tagId, newCycle: cycle });
  }

  private extractSql(calculationRule: Record<string, unknown> | string): string {
    if (typeof calculationRule === 'string') {
      const rule = JSON.parse(calculationRule) as Record<string, unknown>;
      const steps = rule.steps as Array<{ sql: string }> | undefined;
      return rule.ruleType === 'CASCADE' ? (steps?.[0]?.sql ?? '') : (rule.ruleContent as string ?? '');
    }
    const steps = calculationRule.steps as Array<{ sql: string }> | undefined;
    return calculationRule.ruleType === 'CASCADE'
      ? (steps?.[0]?.sql ?? '')
      : (calculationRule.ruleContent as string ?? '');
  }

  private async buildTargetTableMap(tagId: string, calculationRule: Record<string, unknown>): Promise<Map<string, TargetTableData>> {
    const targetTables = new Map<string, TargetTableData>();

    if (calculationRule.ruleType === 'CASCADE' && Array.isArray(calculationRule.steps) && calculationRule.steps.length > 0) {
      const steps = calculationRule.steps as (CascadeStep & { targetTableId?: string })[];
      for (const step of steps) {
        if (step.targetTableId) {
          const targetTable = await this.targetTableRepository.findById(step.targetTableId);
          if (targetTable) {
            targetTables.set(step.targetTableId, {
              id: targetTable.id,
              tableName: targetTable.tableName,
            });
          }
        }
      }
    } else {
      const targetTable = await this.targetTableRepository.findByTagId(tagId);
      if (targetTable) {
        targetTables.set(targetTable.id, {
          id: targetTable.id,
          tableName: targetTable.tableName,
        });
      }
    }

    return targetTables;
  }

  private parseUpdateCycle(cycle: string): UpdateCycle {
    const mapping: Record<string, UpdateCycle> = {
      REALTIME: UpdateCycle.REALTIME,
      HOURLY: UpdateCycle.HOURLY,
      DAILY: UpdateCycle.DAILY,
      WEEKLY: UpdateCycle.WEEKLY,
      MONTHLY: UpdateCycle.MONTHLY,
    };
    return mapping[cycle] || UpdateCycle.DAILY;
  }

  private isFullCreateStatement(sql: string): boolean {
    const upper = sql.toUpperCase().trimStart();
    return upper.startsWith('CREATE MATERIALIZED VIEW') || upper.startsWith('CREATE OR REPLACE');
  }

  private extractMvNameFromSql(sql: string): string | null {
    const match = sql.match(/CREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([^`\s(]+)`?/i);
    return match ? match[1] : null;
  }

  private extractTargetTableFromSql(sql: string): string | null {
    const match = sql.match(/TO\s+`?([^`\s]+)`?/i);
    return match ? match[1] : null;
  }

  private async rollbackActivation(config: MvConfig): Promise<void> {
    try {
      await this.mvDomainService.deleteMv(config);
    } catch (e) {
      log.warn('回滚 MV 失败', { error: e });
    }
  }

  private async getBitmapTableName(tagId: string): Promise<string | undefined> {
    try {
      const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tagId);
      return bitAssignment?.bitmapTableName || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 获取 ENUM 标签的单一 bitmap MV 名称
   * 格式: mv_tag_{tagId}_v{version}_enum_bitmap
   */
  private getEnumBitmapMvName(tagId: string, version: number): string {
    return `mv_tag_${tagId}_v${version}_enum_bitmap`;
  }

  /**
   * 获取 ENUM 标签的 bitmap 表名称（基于原 bitmap 表名 + _enum 后缀）
   */
  private async getEnumBitmapTableName(tagId: string): Promise<string | undefined> {
    const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tagId);
    return bitAssignment?.bitmapTableName ? bitAssignment.bitmapTableName + '_enum' : undefined;
  }

  /**
   * 删除 ENUM 标签的 bitmap 表和 MV（静默失败）
   */
  private async dropEnumBitmapMvs(tagId: string, version: number, bitmapTableName?: string): Promise<void> {
    // 删除 ENUM bitmap MV（标准命名 _enum_bitmap）
    const enumBitmapMvName = this.getEnumBitmapMvName(tagId, version);
    try {
      await this.chClient.dropMaterializedView(enumBitmapMvName);
      log.info('删除 ENUM bitmap MV', { tagId, mvName: enumBitmapMvName });
    } catch (error) {
      log.warn('删除 ENUM bitmap MV 失败（可能不存在）', { tagId, mvName: enumBitmapMvName, error });
    }

    // 删除非标准命名的 bitmap MV（_bitmap 后缀，由 rebuild/updateCycle 创建）
    const bitmapMvName = `mv_tag_${tagId}_v${version}_bitmap`;
    try {
      await this.chClient.dropMaterializedView(bitmapMvName);
      log.info('删除 bitmap MV', { tagId, mvName: bitmapMvName });
    } catch (error) {
      log.warn('删除 bitmap MV 失败（可能不存在）', { tagId, mvName: bitmapMvName, error });
    }

    // 删除 ENUM bitmap 表
    const enumTableName = bitmapTableName ? bitmapTableName + '_enum' : await this.getEnumBitmapTableName(tagId);
    if (enumTableName) {
      try {
        await this.chClient.dropTable(enumTableName);
        log.info('删除 ENUM bitmap 表', { tagId, enumTableName });
      } catch (error) {
        log.warn('删除 ENUM bitmap 表失败（可能不存在）', { tagId, enumTableName, error });
      }
    }
  }

  /**
   * 停用 ENUM 标签的 bitmap MV（静默失败）
   */
  private async stopEnumBitmapMvs(tagId: string, version: number, _enumValues: string[]): Promise<void> {
    const mvName = this.getEnumBitmapMvName(tagId, version);
    try {
      await this.chClient.stopView(mvName);
      log.info('停用 ENUM bitmap MV', { tagId, mvName });
    } catch (error) {
      log.warn('停用 ENUM bitmap MV 失败', { tagId, mvName, error });
    }
  }

  /**
   * 启用 ENUM 标签的 bitmap MV（静默失败）
   */
  private async startEnumBitmapMvs(tagId: string, version: number, _enumValues: string[]): Promise<void> {
    const mvName = this.getEnumBitmapMvName(tagId, version);
    try {
      await this.chClient.startView(mvName);
      log.info('启用 ENUM bitmap MV', { tagId, mvName });
    } catch (error) {
      log.warn('启用 ENUM bitmap MV 失败', { tagId, mvName, error });
    }
  }

  async rebuildMv(command: RebuildMvCommand): Promise<RebuildMvResult> {
    const { tagId } = command;

    try {
      const tag = await this.tagDomainService.getTag(tagId);
      if (!tag) {
        return new RebuildMvResult(false, [], [], `标签不存在: ${tagId}`);
      }

      const version = tag.currentVersion;
      if (!version) {
        return new RebuildMvResult(false, [], [], '标签没有当前版本');
      }

      const sql = this.extractSql(version.calculationRule ?? '');
      if (!sql || sql.trim() === '') {
        return new RebuildMvResult(false, [], [], '当前版本没有有效的计算规则');
      }

      const parsedRule = typeof version.calculationRule === 'string'
        ? JSON.parse(version.calculationRule)
        : ((version.calculationRule as unknown) as Record<string, unknown>) ?? {};
      const targetTables = await this.buildTargetTableMap(tag.id, parsedRule);
      const bitmapTableName = await this.getBitmapTableName(tagId);

      const mvConfig = MvConfig.fromTagWithTargetTables(
        { id: tag.id, updateCycle: tag.updateCycle as unknown as UpdateCycle },
        { version: version.version, calculationRule: version.calculationRule ?? '{}' },
        targetTables,
        bitmapTableName,
      );

      // Step 1: 清理旧 MV（幂等，不存在则忽略），保留目标表
      try {
        await this.mvDomainService.deleteMvOnly(mvConfig);
      } catch (error) {
        log.warn('重建前清理旧 MV 失败（可能不存在）', { tagId, error });
      }

      const enumValues: string[] = Array.isArray(version.enumValues)
        ? (version.enumValues as unknown as string[]) : [];
      if (tag.dataType === TagValueType.ENUM && enumValues.length > 0) {
        const btName = await this.getBitmapTableName(tagId);
        await this.dropEnumBitmapMvs(tagId, version.version, btName);
      }

      // Step 2: 创建主 MV
      const mvNames: string[] = [];
      const tableNames: string[] = [];

      try {
        await this.mvDomainService.createMv(mvConfig, sql);
        mvNames.push(...mvConfig.allMvNames);
        tableNames.push(...mvConfig.allMvResultTables);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'MV 创建失败';
        log.error('重建 MV 失败', { tagId, error: errorMsg });
        return new RebuildMvResult(false, [], [], errorMsg);
      }

      // Step 3: 创建 bitmap MV
      if (mvConfig.bitmapMvName && mvConfig.bitmapTableName) {
        const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tagId);
        if (bitAssignment?.bitPosition != null) {
          try {
            await this.chClient.createBitmapMaterializedView(
              mvConfig.bitmapMvName,
              mvConfig.bitmapTableName,
              sql,
              bitAssignment.bitPosition,
            );
            mvNames.push(mvConfig.bitmapMvName);
          } catch (error) {
            log.warn('重建 bitmap MV 失败，不影响主 MV', { tagId, error });
          }
        }
      }

      // Step 4: 更新 PG 中的 MV 配置
      try {
        await this.mvConfigRepository.deleteByTagId(tagId);
        await this.mvConfigRepository.create({
          id: randomUUID(),
          tagId: tag.id,
          versionId: tag.currentVersionId!,
          mvName: mvConfig.mvName,
          mvResultTable: mvConfig.mvResultTable,
          refreshInterval: mvConfig.refreshInterval,
          ownedBy: tag.ownedBy,
          stepOrder: 1,
          isCascade: mvConfig.isCascade,
          createTime: new Date(),
        });
      } catch (error) {
        log.error('更新 MV 配置失败', { tagId, error });
      }

      log.info('MV 重建成功', { tagId, mvNames, tableNames });
      return new RebuildMvResult(true, mvNames, tableNames);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '重建失败';
      log.error('rebuildMv 异常', { tagId, error: errorMsg });
      return new RebuildMvResult(false, [], [], errorMsg);
    }
  }
}
