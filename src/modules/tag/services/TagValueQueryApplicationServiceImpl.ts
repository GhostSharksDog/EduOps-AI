import {
  ITagValueQueryApplicationService,
  GetTagValuesCommand,
  GetTagValueCommand,
  GetTagValuesPaginatedCommand,
  TagValueResult,
  PaginatedTagValues,
} from '@/modules/tag/services/TagValueQueryApplicationService';
import { TagDomainService } from '@/modules/tag/domain/services/ports/TagDomainService';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { IMaterializedViewConfigRepository } from '@/modules/tag/domain/ports/IMaterializedViewConfigRepository';
import { ITargetTableRepository } from '@/modules/tag/domain/ports/ITargetTableRepository';

interface CHTagValue {
  entity_id: string;
  value: unknown;
}

export class TagValueQueryApplicationServiceImpl implements ITagValueQueryApplicationService {
  constructor(
    private readonly tagDomainService: TagDomainService,
    private readonly chClient: IClickHouseClientAdapter,
    private readonly mvConfigRepository: IMaterializedViewConfigRepository,
    private readonly targetTableRepository: ITargetTableRepository
  ) {}

  async getTagValues(command: GetTagValuesCommand): Promise<TagValueResult[]> {
    const { tagId, entityIds, versionId } = command;

    if (entityIds.length > 1000) {
      throw new Error('entityIds 最多 1000 个');
    }

    const { tableName, needsFinal } = await this.getTargetTableInfo(tagId, versionId);

    const entityIdList = entityIds.map((id) => `'${id}'`).join(',');
    const finalClause = needsFinal ? ' FINAL' : '';
    const sql = `
      SELECT entity_id, tag_value as value
      FROM ${tableName}${finalClause}
      WHERE entity_id IN (${entityIdList})
    `.trim();

    const results = await this.chClient.query<CHTagValue>(sql);

    return results.map((row) => new TagValueResult(row.entity_id, row.value));
  }

  async getTagValue(command: GetTagValueCommand): Promise<TagValueResult | null> {
    const results = await this.getTagValues(
      new GetTagValuesCommand(command.tagId, [command.entityId], command.versionId)
    );
    return results[0] || null;
  }

  async getTagValuesPaginated(command: GetTagValuesPaginatedCommand): Promise<PaginatedTagValues> {
    const { tagId, cursor, limit } = command;
    const { tableName, needsFinal } = await this.getTargetTableInfo(tagId);

    const finalClause = needsFinal ? ' FINAL' : '';
    let sql = `SELECT entity_id, tag_value as value FROM ${tableName}${finalClause}`;

    if (cursor) {
      sql += ` WHERE entity_id > '${cursor}'`;
    }

    sql += ` ORDER BY entity_id LIMIT ${limit + 1}`;

    const results = await this.chClient.query<CHTagValue>(sql);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return new PaginatedTagValues(
      data.map((row) => new TagValueResult(row.entity_id, row.value)),
      hasMore,
      data.length > 0 ? data[data.length - 1].entity_id : undefined
    );
  }

  private async getTargetTableInfo(tagId: string, versionId?: string): Promise<{ tableName: string; needsFinal: boolean }> {
    const tag = await this.tagDomainService.getTag(tagId);
    if (!tag) {
      throw new Error(`标签不存在: ${tagId}`);
    }

    const targetVersionId = versionId || tag.currentVersionId;
    if (!targetVersionId) {
      throw new Error(`标签没有当前版本: ${tagId}`);
    }

    const configs = await this.mvConfigRepository.findByTagIdAndVersionId(tagId, targetVersionId);

    if (!configs || configs.length === 0) {
      throw new Error(`标签 ${tagId} 版本 ${targetVersionId} 没有 MV 配置。请先激活标签。`);
    }

    const lastConfig = configs.reduce((prev, curr) =>
      prev.stepOrder > curr.stepOrder ? prev : curr
    );

    let needsFinal = false;
    if (lastConfig.mvResultTable) {
      const targetTable = await this.targetTableRepository.findByTableName(lastConfig.mvResultTable);
      needsFinal = targetTable?.tableType === 'VIEW';
    }

    return { tableName: lastConfig.mvResultTable, needsFinal };
  }
}
