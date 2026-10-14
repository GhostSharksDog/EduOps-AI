/**
 * 查询标签值命令
 */
export class GetTagValuesCommand {
  constructor(
    public readonly tagId: string,
    public readonly entityIds: string[],
    public readonly versionId?: string
  ) {}
}

/**
 * 查询单个实体标签值命令
 */
export class GetTagValueCommand {
  constructor(
    public readonly tagId: string,
    public readonly entityId: string,
    public readonly versionId?: string
  ) {}
}

/**
 * 分页查询标签值命令
 */
export class GetTagValuesPaginatedCommand {
  constructor(
    public readonly tagId: string,
    public readonly cursor?: string,
    public readonly limit: number = 100
  ) {}
}

/**
 * 标签值结果
 */
export class TagValueResult {
  constructor(
    public readonly entityId: string,
    public readonly value: unknown,
    public readonly calculatedAt?: Date
  ) {}
}

/**
 * 分页标签值结果
 */
export class PaginatedTagValues {
  constructor(
    public readonly data: TagValueResult[],
    public readonly hasMore: boolean,
    public readonly nextCursor?: string
  ) {}
}

/**
 * 标签值查询应用服务接口
 *
 * 架构说明:
 * 1. 查询 ClickHouse 目标表获取标签值
 * 2. 支持批量查询和分页查询
 * 3. 完全替换 TagValue (PG) 方案
 */
export interface ITagValueQueryApplicationService {
  /**
   * 批量查询标签值
   */
  getTagValues(command: GetTagValuesCommand): Promise<TagValueResult[]>;

  /**
   * 查询单个实体标签值
   */
  getTagValue(command: GetTagValueCommand): Promise<TagValueResult | null>;

  /**
   * 分页查询标签值
   */
  getTagValuesPaginated(command: GetTagValuesPaginatedCommand): Promise<PaginatedTagValues>;
}


