import {
  IClickHouseClientAdapter,
  ClickHouseConfig,
  MvRefreshStatus,
} from '@/platform/database/interface/IClickHouseClientAdapter';
import { log } from '@/platform/logger';
import { config } from '@/platform/config/index';

/** UInt64位图使用BigInt，避免JavaScript位运算只保留32位。 */
function bitmapBitValue(position: number): bigint {
  if (!Number.isInteger(position) || position < 0 || position > 63) {
    throw new Error('bitPosition 必须是 0 到 63 之间的整数');
  }
  return BigInt(1) << BigInt(position);
}


/**
 * ClickHouse 客户端适配器实现
 *
 * 统一使用 HTTP 接口（fetch）与 ClickHouse 通信
 * 支持 Refreshable MV 操作（需要 CH 24.8+）
 */
export class ClickHouseClientAdapterImpl implements IClickHouseClientAdapter {
  private readonly explicitConfig?: ClickHouseConfig;
  private get config():ClickHouseConfig {return this.explicitConfig??this.getConfigFromEnv();}

  constructor(config?: ClickHouseConfig) {
    this.explicitConfig = config;
  }

  /**
   * 转义字符串用于 ClickHouse SQL 查询
   * 防止 SQL 注入攻击
   */
  private escapeString(value: string): string {
    // ClickHouse 使用单引号作为字符串分隔符
    // 转义单引号的方法是将单个单引号替换为两个单引号
    return value.replace(/'/g, "''");
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getConfigFromEnv(): ClickHouseConfig {
    return {
      host: config.clickhouse.host,
      port: config.clickhouse.port,
      username: config.clickhouse.user,
      password: config.clickhouse.password,
      database: config.clickhouse.database,
      cluster: config.clickhouse.cluster,
      replicatedDb: config.clickhouse.replicatedDb,
    };
  }

  /**
   * 返回 ON CLUSTER 子句
   * Replicated Database 引擎自动复制 DDL，不需要（也不允许）ON CLUSTER
   * Atomic 引擎的库仍需 ON CLUSTER 来分发 DDL
   */
  private onCluster(): string {
    if (this.config.replicatedDb) return '';
    return this.config.cluster ? ` ON CLUSTER '${this.config.cluster}'` : '';
  }

  private isClusterMode(): boolean {
    return !!this.config.cluster;
  }

  private localTableName(tableName: string): string {
    if (tableName.includes('.')) {
      const [db, tbl] = tableName.split('.');
      return `${db}.${tbl}_local`;
    }
    return `${tableName}_local`;
  }

  private replicatedEngine(baseEngine: string): string {
    const zkPath = '/clickhouse/tables/{shard}/{database}/{table}';
    const engineMap: Record<string, string> = {
      'MergeTree()': `ReplicatedMergeTree('${zkPath}', '{replica}')`,
      'ReplacingMergeTree()': `ReplicatedReplacingMergeTree('${zkPath}', '{replica}')`,
      'AggregatingMergeTree()': `ReplicatedAggregatingMergeTree('${zkPath}', '{replica}')`,
    };
    return engineMap[baseEngine] || baseEngine;
  }

  // Replicated Database 下不需要指定 ZK 路径，数据库自动提供
  private replicatedEngineNoArgs(baseEngine: string): string {
    const engineMap: Record<string, string> = {
      'MergeTree()': 'ReplicatedMergeTree()',
      'ReplacingMergeTree()': 'ReplicatedReplacingMergeTree()',
      'AggregatingMergeTree()': 'ReplicatedAggregatingMergeTree()',
    };
    return engineMap[baseEngine] || baseEngine;
  }

  private transformSqlToLocal(sql: string): { localSql: string; tableName: string; localName: string } | null {
    const match = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:`([^`]+)`|(\w+(?:\.\w+)?))/i);
    if (!match) return null;

    const tableName = match[1] || match[2];
    const localName = this.localTableName(tableName);

    let localSql = sql;
    // Replicated Database 下用不带参数的 Replicated 引擎，Atomic 下用带 ZK 路径的
    const engineFn = this.config.replicatedDb
      ? (e: string) => this.replicatedEngineNoArgs(e)
      : (e: string) => this.replicatedEngine(e);
    localSql = localSql.replace(
      /ENGINE\s*=\s*(MergeTree\(\)|ReplacingMergeTree\(\)|AggregatingMergeTree\(\))/i,
      (_, engine) => `ENGINE = ${engineFn(engine)}`
    );

    localSql = localSql.replace(
      new RegExp(`\\\`?${this.escapeRegex(tableName)}\\\`?`),
      this.quoteIdentifier(localName)
    );

    return { localSql, tableName, localName };
  }

  private async createDistributedTable(tableName: string): Promise<void> {
    const localName = this.localTableName(tableName);
    // Distributed 表使用不带 _local 的逻辑名
    const parts = localName.split('.');
    const localSimpleName = parts.length === 2 ? parts[1] : localName;

    const sql = `CREATE TABLE IF NOT EXISTS ${this.quoteIdentifier(tableName)}${this.onCluster()}
      ENGINE = Distributed('${this.config.cluster}', currentDatabase(), '${this.escapeString(localSimpleName)}', rand())`;

    log.info('创建 Distributed 表', { tableName, localName, cluster: this.config.cluster });
    await this.execute(sql);
  }

  async testConnection(cfg: ClickHouseConfig): Promise<boolean> {
    try {
      const url = this.buildUrl(cfg);
      const resp = await fetch(url, {
        method: 'POST',
        body: 'SELECT 1',
        headers: this.authenticationHeaders(cfg),
        signal: AbortSignal.timeout(10000),
      });
      return resp.ok;
    } catch (error) {
      log.error('ClickHouse 连接测试失败', error);
      return false;
    }
  }

  /**
   * 执行查询（返回结果）
   * 自动追加 FORMAT JSON 并解析响应
   */
  async query<T>(sql: string): Promise<T[]> {
    try {
      const url = `${this.baseUrl()}&allow_experimental_refreshable_materialized_view=1`;
      const resp = await fetch(url, {
        method: 'POST',
        body: `${sql} FORMAT JSON`,
        headers: this.authenticationHeaders(),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`ClickHouse HTTP ${resp.status}: ${err}`);
      }
      const json = await resp.json() as { data: T[] };
      return json.data || [];
    } catch (error) {
      log.error('ClickHouse 查询失败', { sql, error });
      throw error;
    }
  }

  async execute(sql: string): Promise<void> {
    try {
      const resp = await fetch(this.baseUrl(), {
        method: 'POST',
        body: sql,
        headers: this.authenticationHeaders(),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`ClickHouse HTTP ${resp.status}: ${err}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log.error('ClickHouse 执行失败', { sql: sql.substring(0, 200), errMsg });
      throw error;
    }
  }

  /**
   * 将标识符用反引号包裹，防止包含特殊字符（如 UUID 中的连字符）导致语法错误
   */
  private quoteIdentifier(name: string): string {
    // 如果已经包含点号（database.table 形式），分别引用每部分
    if (name.includes('.')) {
      return name.split('.').map(part => `\`${part}\``).join('.');
    }
    return `\`${name}\``;
  }

  async createMaterializedView(
    mvName: string,
    targetTableName: string,
    refreshInterval: string,
    query: string,
    isRealtime: boolean = true,
  ): Promise<void> {
    // 集群模式下 MV 写入 _local 表
    const effectiveTarget = this.isClusterMode() ? this.localTableName(targetTableName) : targetTableName;
    const quotedMvName = this.quoteIdentifier(mvName);
    const quotedTargetTable = this.quoteIdentifier(effectiveTarget);

    const trimmedQuery = query.trim();

    // 用户写了完整 CREATE 语句的情况
    if (this.isFullCreateStatement(trimmedQuery)) {
      if (isRealtime) {
        // REALTIME：直接执行用户 SQL（TO 模式）
        let safeQuery = this.injectIfNotExists(trimmedQuery);
        if (this.isClusterMode()) {
          safeQuery = this.rewriteToLocalTarget(safeQuery);
        }
        const clusterQuery = this.injectOnCluster(safeQuery, 'CREATE MATERIALIZED VIEW');
        log.info('执行完整物化视图 SQL（TO 模式）', { mvName, targetTableName: effectiveTarget, query: clusterQuery.substring(0, 100) });
        await this.execute(clusterQuery);
      } else {
        // 非 REALTIME：提取 SELECT 部分，重建为 REFRESH 模式
        // Replicated Database 支持协调刷新，无需降级引擎
        const selectSql = this.extractSelectFromCreate(trimmedQuery);
        const sql = `
          CREATE MATERIALIZED VIEW IF NOT EXISTS ${quotedMvName}${this.onCluster()}
          ${refreshInterval} TO ${quotedTargetTable}
          AS ${selectSql}
        `;
        log.info('执行完整物化视图 SQL（REFRESH 模式）', { mvName, refreshInterval, query: sql.substring(0, 150) });
        await this.executeWithRefreshEnabled(sql);
      }
      return;
    }

    // 纯 SELECT 语句
    if (isRealtime) {
      // REALTIME：TO 模式（INSERT 触发）
      const sql = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${quotedMvName}${this.onCluster()}
        TO ${quotedTargetTable}
        AS ${trimmedQuery}
      `;
      log.info('创建物化视图（TO 模式）', { mvName, targetTableName: effectiveTarget, query: trimmedQuery.substring(0, 100) });
      await this.execute(sql);
    } else {
      // 非 REALTIME：REFRESH 模式（定时重算）
      // Replicated Database 支持协调刷新，无需降级引擎
      const sql = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${quotedMvName}${this.onCluster()}
        ${refreshInterval} TO ${quotedTargetTable}
        AS ${trimmedQuery}
      `;
      log.info('创建物化视图（REFRESH 模式）', { mvName, targetTableName: effectiveTarget, refreshInterval, query: trimmedQuery.substring(0, 100) });
      await this.executeWithRefreshEnabled(sql);
    }
  }

  private rewriteToLocalTarget(sql: string): string {
    return sql.replace(
      /\bTO\s+`?(\w+(?:\.\w+)?)`?/gi,
      (_, table) => `TO ${this.quoteIdentifier(this.localTableName(table))}`
    );
  }

  /**
   * 带 allow_experimental_refreshable_materialized_view 标志执行 SQL
   * ClickHouse 24.8 的 REFRESH MV 是实验性功能，需要在连接参数中开启
   */
  private async executeWithRefreshEnabled(sql: string): Promise<void> {
    const url = `${this.baseUrl()}&allow_experimental_refreshable_materialized_view=1`;
    const resp = await fetch(url, {
      method: 'POST',
      body: sql,
      headers: this.authenticationHeaders(),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`ClickHouse error: ${errText}`);
    }
  }

  /**
   * 获取基础 HTTP URL（不含查询参数）
   */
  private baseUrl(): string {
    return this.buildUrl(this.config);
  }

  private buildUrl(cfg: ClickHouseConfig): string {
    const url=new URL(/^https?:\/\//.test(cfg.host)?cfg.host:`http://${cfg.host}:${cfg.port}`);
    if(url.username||url.password)throw new Error('ClickHouse 地址不可包含凭据');
    url.searchParams.set('database',cfg.database??'default');return url.toString();
  }
  private authenticationHeaders(cfg:ClickHouseConfig=this.config):Record<string,string>{
    return {'Content-Type':'text/plain','X-ClickHouse-User':cfg.username,'X-ClickHouse-Key':cfg.password};
  }

  /**
   * 从完整 CREATE MATERIALIZED VIEW ... AS SELECT ... 语句中提取 SELECT 部分
   */
  private extractSelectFromCreate(sql: string): string {
    const asMatch = sql.match(/\bAS\s+([\s\S]+)$/i);
    return asMatch ? asMatch[1].trim() : sql;
  }

  private injectIfNotExists(sql: string): string {
    return sql.replace(
      /CREATE\s+MATERIALIZED\s+VIEW\s+(IF\s+NOT\s+EXISTS\s+)?/i,
      'CREATE MATERIALIZED VIEW IF NOT EXISTS '
    );
  }

  /**
   * 在用户自定义 DDL 语句中注入 ON CLUSTER 子句
   * 匹配 "CREATE MATERIALIZED VIEW ... (" 或 "CREATE TABLE ... (" 模式
   */
  private injectOnCluster(sql: string, prefix: string): string {
    if (!this.config.cluster) return sql;
    const escapedPrefix = prefix.replace(/\s+/g, '\\s+');
    const pattern = '(' + escapedPrefix + ')\\s+(IF\\s+NOT\\s+EXISTS\\s+)?(\\S+)';
    const regex = new RegExp(pattern, 'i');
    return sql.replace(regex, `$1 $2$3${this.onCluster()}`);
  }

  private isFullCreateStatement(sql: string): boolean {
    const upper = sql.toUpperCase().trimStart();
    return upper.startsWith('CREATE MATERIALIZED VIEW') || upper.startsWith('CREATE OR REPLACE');
  }

  async createBitmapMaterializedView(
    mvName: string,
    bitmapTableName: string,
    sourceQuery: string,
    bitPosition: number,
    whereClause: string = 'tag_value != 0',
  ): Promise<void> {
    const effectiveBitmapTable = this.isClusterMode() ? this.localTableName(bitmapTableName) : bitmapTableName;
    const quotedMvName = this.quoteIdentifier(mvName);
    const quotedBitmapTable = this.quoteIdentifier(effectiveBitmapTable);
    const bitValue = bitmapBitValue(bitPosition);

    let query = sourceQuery.trim();
    if (query.toUpperCase().startsWith('CREATE MATERIALIZED VIEW') || query.toUpperCase().startsWith('CREATE OR REPLACE')) {
      const asMatch = query.match(/\bAS\s+([\s\S]+)$/i);
      query = asMatch ? asMatch[1].trim() : '';
    }

    const sql = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${quotedMvName}${this.onCluster()}
      TO ${quotedBitmapTable}
      AS
      SELECT
        entity_id,
        toUInt64(${bitValue}) AS bitmap_col
      FROM (
        ${query}
      )
      WHERE ${whereClause}
      GROUP BY entity_id
    `;

    log.info('创建 bitmap 物化视图', { mvName, bitmapTableName: effectiveBitmapTable, bitPosition, query: query.substring(0, 100) });

    await this.execute(sql);
  }

  async createEnumBitmapTable(tableName: string): Promise<void> {
    if (this.isClusterMode()) {
      const localName = this.localTableName(tableName);
      const quotedLocal = this.quoteIdentifier(localName);
      // Replicated Database 下不需要手动指定 Replicated 引擎，否则报错
      const engine = this.config.replicatedDb ? this.replicatedEngineNoArgs('ReplacingMergeTree()') : this.replicatedEngine('ReplacingMergeTree()');
      const sql = `
        CREATE TABLE IF NOT EXISTS ${quotedLocal}${this.onCluster()} (
          entity_id String,
          bitmap_col UInt64
        )
        ENGINE = ${engine}
        ORDER BY entity_id
      `;
      await this.execute(sql);
      log.info('创建 ENUM bitmap 本地表', { tableName, localName, engine });
      await this.createDistributedTable(tableName);
    } else {
      const quoted = this.quoteIdentifier(tableName);
      const sql = `
        CREATE TABLE IF NOT EXISTS ${quoted}${this.onCluster()} (
          entity_id String,
          bitmap_col UInt64
        )
        ENGINE = ReplacingMergeTree()
        ORDER BY entity_id
      `;
      await this.execute(sql);
      log.info('创建 ENUM bitmap 表（ReplacingMergeTree）', { tableName });
    }
  }

  async createEnumBitmapMaterializedView(
    mvName: string,
    enumBitmapTableName: string,
    sourceQuery: string,
    enumBitMapping: Array<{ value: string; bitPosition: number }>,
    refreshInterval?: string,
    isRealtime: boolean = true,
  ): Promise<void> {
    const effectiveTableName = this.isClusterMode() ? this.localTableName(enumBitmapTableName) : enumBitmapTableName;
    const quotedMvName = this.quoteIdentifier(mvName);
    const quotedTable = this.quoteIdentifier(effectiveTableName);

    // 构建 multiIf 分支: multiIf(tag_value='低', 1<<0, tag_value='中', 1<<1, ..., 0)
    const branches: string[] = [];
    for (const { value, bitPosition } of enumBitMapping) {
      const escaped = value.replace(/'/g, "\\'");
      branches.push(`tag_value = '${escaped}'`);
      branches.push(`toUInt64(${bitmapBitValue(bitPosition)})`);
    }

    const multiIfExpr = `multiIf(${branches.join(', ')}, toUInt64(0))`;

    let query = sourceQuery.trim();
    if (query.toUpperCase().startsWith('CREATE MATERIALIZED VIEW') || query.toUpperCase().startsWith('CREATE OR REPLACE')) {
      const asMatch = query.match(/\bAS\s+([\s\S]+)$/i);
      query = asMatch ? asMatch[1].trim() : '';
    }

    const selectPart = `
      SELECT
        entity_id,
        ${multiIfExpr} AS bitmap_col
      FROM (
        ${query}
      )
    `;

    let sql: string;
    if (isRealtime) {
      // REALTIME：TO 模式（INSERT 触发）
      sql = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${quotedMvName}${this.onCluster()}
        TO ${quotedTable}
        AS ${selectPart}
      `;
    } else {
      // 非 REALTIME：REFRESH 模式（定时重算）
      // Replicated Database 支持协调刷新，无需降级引擎
      sql = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${quotedMvName}${this.onCluster()}
        ${refreshInterval} TO ${quotedTable}
        AS ${selectPart}
      `;
    }

    log.info('创建 ENUM bitmap 物化视图', {
      mvName,
      enumBitmapTableName,
      mode: isRealtime ? 'TO（INSERT 触发）' : `REFRESH（${refreshInterval}）`,
      mapping: enumBitMapping.map(m => `${m.value}→bit${m.bitPosition}`).join(', '),
    });

    if (isRealtime) {
      await this.execute(sql);
    } else {
      await this.executeWithRefreshEnabled(sql);
    }
  }

  async createTable(sql: string): Promise<void> {
    if (!this.isClusterMode()) {
      await this.execute(sql);
      return;
    }

    const result = this.transformSqlToLocal(sql);
    if (!result) {
      log.warn('无法解析 CREATE TABLE SQL，回退到非集群模式', { sql: sql.substring(0, 200) });
      sql = sql.replace(
        /CREATE TABLE IF NOT EXISTS (`[^`]+`|\w+(\.\w+)?)/,
        `CREATE TABLE IF NOT EXISTS $1${this.onCluster()}`
      );
      await this.execute(sql);
      return;
    }

    const { localSql, tableName, localName } = result;

    // Step 1: 创建 _local Replicated 表
    const localWithOnCluster = localSql.replace(
      /CREATE TABLE IF NOT EXISTS (`[^`]+`|\w+(\.\w+)?)/,
      `CREATE TABLE IF NOT EXISTS $1${this.onCluster()}`
    );
    log.info('创建本地表', { tableName, localName, replicatedDb: this.config.replicatedDb });
    await this.execute(localWithOnCluster);

    // Step 2: 创建 Distributed 表
    await this.createDistributedTable(tableName);
  }

  /**
   * 将 Replicated 的 _local 表转换为普通 MergeTree
   * REFRESHABLE MV 在 Atomic 数据库中不支持写入 Replicated 表
   * 转换后每个节点独立刷新，Distributed 表默认从每个 shard 的一个副本读取
   */
  async convertToLocalNonReplicated(tableName: string): Promise<void> {
    if (!this.isClusterMode()) return;

    const localName = this.localTableName(tableName);
    const localSimpleName = localName.split('.').pop()! || localName;
    const quotedLocal = this.quoteIdentifier(localName);

    // 检查 _local 表引擎
    const result = await this.query<{ engine: string }>(
      `SELECT engine FROM system.tables WHERE name = '${this.escapeString(localSimpleName)}' AND database = currentDatabase()`
    );

    if (result.length === 0 || !result[0].engine.startsWith('Replicated')) {
      return; // 已经是非 Replicated 或不存在
    }

    // 获取建表语句并替换引擎
    const createResult = await this.query<{ create_table_query: string }>(
      `SELECT create_table_query FROM system.tables WHERE name = '${this.escapeString(localSimpleName)}' AND database = currentDatabase()`
    );
    if (createResult.length === 0) return;

    let createSql = createResult[0].create_table_query;

    // ReplicatedMergeTree('zk_path', 'replica') → MergeTree()
    createSql = createSql.replace(
      /ENGINE\s*=\s*Replicated(\w+Tree)\s*\(\s*'[^']*'\s*,\s*'[^']*'\s*\)/i,
      'ENGINE = $1()'
    );

    // 删除旧表
    await this.execute(`DROP TABLE IF EXISTS ${quotedLocal}${this.onCluster()} SYNC`);

    // 重建为非 Replicated 表：ON CLUSTER 必须放在表名之后
    createSql = createSql.replace(
      /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)(`[^`]+`(?:\.`[^`]+`)*|[\w.]+)/i,
      `$1$2${this.onCluster()}`
    );
    await this.execute(createSql);
    log.info('已将 _local 表从 Replicated 转换为普通引擎（用于 REFRESHABLE MV）', { tableName, localName });
  }

  async dropTable(tableName: string): Promise<void> {
    if (this.isClusterMode()) {
      await this.execute(`DROP TABLE IF EXISTS ${this.quoteIdentifier(tableName)}${this.onCluster()} SYNC`);
      await this.execute(`DROP TABLE IF EXISTS ${this.quoteIdentifier(this.localTableName(tableName))}${this.onCluster()} SYNC`);
    } else {
      await this.execute(`DROP TABLE IF EXISTS ${this.quoteIdentifier(tableName)}${this.onCluster()} SYNC`);
    }
  }

  async dropMaterializedView(mvName: string): Promise<void> {
    await this.execute(`DROP TABLE IF EXISTS ${this.quoteIdentifier(mvName)}${this.onCluster()}`);
  }

  async stopView(mvName: string): Promise<void> {
    await this.execute(`SYSTEM STOP VIEW ${this.quoteIdentifier(mvName)}${this.onCluster()}`);
  }

  async startView(mvName: string): Promise<void> {
    await this.execute(`SYSTEM START VIEW ${this.quoteIdentifier(mvName)}${this.onCluster()}`);
  }

  async getRefreshStatus(mvName: string): Promise<MvRefreshStatus | null> {
    // 1. 先查 system.view_refreshes（REFRESHABLE MV）
    // 集群模式下每个副本有独立 scheduler，需聚合所有副本取最新时间和任意异常
    const escapedMvName = this.escapeString(mvName);

    const refreshSql = this.config.cluster
      ? `
        SELECT
          name,
          max_refresh_time as last_refresh_time,
          any_exception as last_exception,
          latest_status as status,
          if(any_exception != '', 1, 0) as is_stale
        FROM (
          SELECT
            view as name,
            max(last_refresh_time) as max_refresh_time,
            anyIf(exception, exception != '') as any_exception,
            argMax(status, last_refresh_time) as latest_status
          FROM clusterAllReplicas('${this.config.cluster}', system.view_refreshes)
          WHERE view = '${escapedMvName}'
          GROUP BY view
        )
      `
      : `
        SELECT
          view as name,
          last_refresh_time,
          exception as last_exception,
          status,
          if(exception != '', 1, 0) as is_stale
        FROM system.view_refreshes
        WHERE view = '${escapedMvName}'
      `;

    const refreshResults = await this.query<{
      name: string;
      last_refresh_time?: string;
      last_exception?: string;
      status: string;
      is_stale: number;
    }>(refreshSql);

    if (refreshResults.length > 0) {
      return refreshResults[0];
    }

    // 2. fallback: trigger-based MV — 查目标表数据时间
    const mvExists = await this.checkTableExists(mvName);
    if (!mvExists) return null;

    const targetTable = await this.getMvTargetTable(mvName);
    if (!targetTable) {
      return { name: mvName, is_stale: 0 };
    }

    const lastTime = await this.getTableLastUpdateTime(targetTable);
    return {
      name: mvName,
      last_refresh_time: lastTime ?? undefined,
      is_stale: 0,
    };
  }

  async getMvTargetTable(mvName: string): Promise<string | null> {
    const escapedName = this.escapeString(mvName);
    const sql = `
      SELECT create_table_query FROM system.tables
      WHERE name = '${escapedName}' AND engine = 'MaterializedView'
    `;
    const results = await this.query<{ create_table_query: string }>(sql);
    const ddl = results[0]?.create_table_query;
    if (!ddl) return null;
    const match = ddl.match(/\bTO\s+([^\s(]+)/i);
    let targetName = match ? match[1].replace(/`/g, '') : null;
    // 集群模式下 MV 的 TO 指向 _local 表，返回逻辑名
    if (targetName && this.isClusterMode() && targetName.endsWith('_local')) {
      targetName = targetName.slice(0, -6);
    }
    return targetName;
  }

  private async getTableLastUpdateTime(tableName: string): Promise<string | null> {
    // 集群模式下 system.parts 里存的是 _local 表名
    const effectiveTableName = this.isClusterMode() ? this.localTableName(tableName) : tableName;
    const parts = effectiveTableName.split('.');
    const dbName = parts.length === 2 ? this.escapeString(parts[0]) : 'currentDatabase()';
    const tblName = this.escapeString(parts.length === 2 ? parts[1] : parts[0]);

    const fromClause = this.config.cluster
      ? `clusterAllReplicas('${this.config.cluster}', system.parts)`
      : 'system.parts';

    const sql = `
      SELECT max(modification_time) as last_time
      FROM ${fromClause}
      WHERE database = '${dbName}' AND table = '${tblName}' AND active
    `;
    try {
      const results = await this.query<{ last_time?: string }>(sql);
      return results[0]?.last_time || null;
    } catch {
      return null;
    }
  }

  async checkTableExists(tableName: string): Promise<boolean> {
    const parts = tableName.split('.');
    let sql: string;
    
    if (parts.length === 2) {
      const escapedDatabase = this.escapeString(parts[0]);
      const escapedName = this.escapeString(parts[1]);
      sql = `
        SELECT count() as count 
        FROM system.tables 
        WHERE database = '${escapedDatabase}' AND name = '${escapedName}'
      `;
    } else {
      const escapedTableName = this.escapeString(tableName);
      sql = `
        SELECT count() as count 
        FROM system.tables 
        WHERE database = currentDatabase() AND name = '${escapedTableName}'
      `;
    }

    const results = await this.query<{ count: string }>(sql);
    return Number(results[0]?.count || 0) > 0;
  }

  async resetBitmapBit(tableName: string, bitPosition: number): Promise<void> {
    const bitValue = bitmapBitValue(bitPosition);
    const sql = `
      ALTER TABLE ${this.quoteIdentifier(tableName)}${this.onCluster()}
      UPDATE bitmap_col = bitAnd(bitmap_col, bitNot(toUInt64(${bitValue})))
      WHERE 1=1
    `;

    log.info('重置 Bitmap 位', { tableName, bitPosition });

    await this.execute(sql);
  }

  private validateIdentifier(name: string, type: 'table' | 'column'): void {
    const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!IDENTIFIER_PATTERN.test(name)) {
      throw new Error(`无效的 ${type} 标识符: ${name}`);
    }
    const RESERVED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'EXECUTE'];
    if (RESERVED.includes(name.toUpperCase())) {
      throw new Error(`保留字被用作 ${type} 标识符: ${name}`);
    }
  }

  async syncTagBitmap(params: {
    bitmapTableName: string;
    sourceTableName: string;
    bitPosition: number;
    incremental: boolean;
    lastSyncTime?: Date;
  }): Promise<{ affectedRows: number; syncType: 'FULL' | 'INCREMENTAL' }> {
    const {bitmapTableName, sourceTableName, bitPosition, incremental, lastSyncTime} = params;
    this.validateIdentifier(bitmapTableName, 'table');
    this.validateIdentifier(sourceTableName, 'table');
    const bitValue = `toUInt64(${bitmapBitValue(bitPosition)})`;
    const source = this.quoteIdentifier(sourceTableName);
    const bitmap = this.quoteIdentifier(this.isClusterMode() ? this.localTableName(bitmapTableName) : bitmapTableName);
    const columns = await this.query<{name: string; type: string}>(
      `SELECT name,type FROM system.columns WHERE database=currentDatabase() AND table='${this.escapeString(sourceTableName)}'`
    );
    const names = new Set(columns.map(column => column.name));
    const valueName = names.has('tag_value') ? 'tag_value' : names.has('value') ? 'value' : null;
    const timeName = names.has('update_time') ? 'update_time' : names.has('_sign_time') ? '_sign_time' : null;
    if (!names.has('entity_id') || !valueName || !timeName) {
      throw new Error('位图同步需要entity_id、标签值及更新时间字段');
    }
    const value = this.quoteIdentifier(valueName), time = this.quoteIdentifier(timeName);
    const hasSign = names.has('_sign');
    // tuple保留最新NULL值，避免argMax忽略NULL后错误复活旧标签。
    const state = `argMax(tuple(${value}${hasSign ? ',_sign' : ''}),${time})`;
    let changed = `SELECT DISTINCT entity_id FROM ${source}`;
    if (incremental && lastSyncTime) {
      const cutoff = this.escapeString(lastSyncTime.toISOString());
      changed += ` WHERE ${time} >= parseDateTime64BestEffort('${cutoff}')`;
    }
    const filter = incremental ? `entity_id IN (${changed})` : '1=1';
    const current = `SELECT entity_id,${state} AS current FROM ${source} WHERE ${filter} GROUP BY entity_id`;
    const numeric = /(?:U?Int|Float|Decimal|Bool)/.test(columns.find(column => column.name === valueName)!.type);
    const active = `current.1 IS NOT NULL${numeric ? ' AND current.1 != 0' : ''}${hasSign ? ' AND current.2 = 1' : ''}`;
    const count = await this.query<{count: string}>(
      `SELECT count() AS count FROM (SELECT entity_id FROM ${bitmap} WHERE ${filter} UNION DISTINCT ${changed})`
    );
    // 先同步清除目标位，保留其他标签；完成mutation后再插入最新命中，避免清除新结果。
    await this.execute(`ALTER TABLE ${bitmap}${this.onCluster()} UPDATE bitmap_col=bitAnd(bitmap_col,bitNot(${bitValue})) WHERE ${filter} SETTINGS mutations_sync=2`);
    await this.execute(`INSERT INTO ${bitmap} (entity_id,bitmap_col) SELECT entity_id,${bitValue} FROM (${current}) WHERE ${active}`);
    return {affectedRows: Number(count[0]?.count ?? 0), syncType: incremental ? 'INCREMENTAL' : 'FULL'};
  }
}
