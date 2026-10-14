/**
 * ClickHouse 刷新状态
 * 从 system.view_refreshes 系统表获取
 */
export interface MvRefreshStatus {
  name: string;
  last_refresh_time?: string;
  last_exception?: string;
  is_stale: number;
}

/**
 * ClickHouse 配置
 */
export interface ClickHouseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  cluster?: string;
  replicatedDb?: boolean;
}

/**
 * ClickHouse 客户端适配器接口
 *
 * 架构说明:
 * 1. 定义 ClickHouse 操作的抽象接口
 * 2. 支持物化视图的创建、删除、暂停、恢复
 * 3. 支持刷新状态查询
 *
 * 实现约束:
 * - 需处理连接错误和查询超时
 * - 需支持 SQL 执行和结果解析
 */
export interface IClickHouseClientAdapter {
  /**
   * 测试连接
   */
  testConnection(config: ClickHouseConfig): Promise<boolean>;

  /**
   * 执行查询（返回结果）
   */
  query<T>(sql: string): Promise<T[]>;

  /**
   * 执行命令（无返回）
   */
  execute(sql: string): Promise<void>;

  /**
   * 创建物化视图
   * @param mvName 物化视图名称
   * @param targetTableName 目标表名称
   * @param refreshInterval 刷新间隔
   * @param sql 查询 SQL
   * @param isRealtime 是否实时模式（TO 模式，INSERT 触发）；非实时时使用 REFRESH 模式
   */
  createMaterializedView(
    mvName: string,
    targetTableName: string,
    refreshInterval: string,
    sql: string,
    isRealtime?: boolean
  ): Promise<void>;

  /**
   * 删除物化视图
   */
  dropMaterializedView(mvName: string): Promise<void>;

  /**
   * 创建表（自动注入 ON CLUSTER）
   */
  createTable(sql: string): Promise<void>;

  /**
   * 将 Replicated 的 _local 表转换为普通 MergeTree
   * 用于 REFRESHABLE MV（Atomic 数据库不支持写入 Replicated 目标表）
   */
  convertToLocalNonReplicated(tableName: string): Promise<void>;

  /**
   * 删除表
   */
  dropTable(tableName: string): Promise<void>;

  /**
   * 暂停视图
   */
  stopView(mvName: string): Promise<void>;

  /**
   * 恢复视图
   */
  startView(mvName: string): Promise<void>;

  /**
   * 获取刷新状态
   */
  getRefreshStatus(mvName: string): Promise<MvRefreshStatus | null>;

  /**
   * 检查表是否存在
   */
  checkTableExists(tableName: string): Promise<boolean>;

  /**
   * 创建 bitmap 物化视图
   * 将源查询的 entity_id 写入 bitmap 表的对应位
   */
  createBitmapMaterializedView(
    mvName: string,
    bitmapTableName: string,
    sourceQuery: string,
    bitPosition: number,
    whereClause?: string
  ): Promise<void>;

  /**
   * 获取 MV 的目标表名
   * 用于检测 MV 是否指向了正确的目标表
   */
  getMvTargetTable(mvName: string): Promise<string | null>;

  /**
   * 创建 ENUM 专用 bitmap 表（ReplacingMergeTree）
   * 用于存储 ENUM 标签的互斥位掩码
   */
  createEnumBitmapTable(tableName: string): Promise<void>;

  /**
   * 创建 ENUM bitmap 物化视图（单一 MV，multiIf 互斥映射）
   * 将源查询的枚举值映射到对应的 bit 位
   * @param mvName 物化视图名称
   * @param enumBitmapTableName ENUM bitmap 目标表名称
   * @param sourceQuery 源查询 SQL
   * @param enumBitMapping 枚举值到位位置的映射
   * @param refreshInterval 刷新间隔（如 'REFRESH EVERY 1 HOUR'）
   * @param isRealtime 是否实时模式（TO 模式）；非实时时使用 REFRESH 模式
   */
  createEnumBitmapMaterializedView(
    mvName: string,
    enumBitmapTableName: string,
    sourceQuery: string,
    enumBitMapping: Array<{ value: string; bitPosition: number }>,
    refreshInterval?: string,
    isRealtime?: boolean
  ): Promise<void>;

  /**
   * 重置 Bitmap 位
   * 使用 bitmapAndNot 清除特定位
   */
  resetBitmapBit(
    tableName: string,
    bitPosition: number
  ): Promise<void>;

  /**
   * 同步标签值到位图表
   * 支持全量同步和增量同步两种模式
   *
   * @param params.bitmapTableName 位图表名称
   * @param params.sourceTableName 源数据表名称
   * @param params.bitPosition 位位置（0-63）
   * @param params.incremental 是否增量同步
   * @param params.lastSyncTime 增量同步的上次同步时间（可选）
   */
  syncTagBitmap(params: {
    bitmapTableName: string;
    sourceTableName: string;
    bitPosition: number;
    incremental: boolean;
    lastSyncTime?: Date;
  }): Promise<{ affectedRows: number; syncType: 'FULL' | 'INCREMENTAL' }>;
}

