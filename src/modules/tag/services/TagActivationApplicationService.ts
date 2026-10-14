/**
 * 激活标签命令
 */
export class ActivateTagCommand {
  constructor(
    public readonly tagId: string,
    public readonly userId: string
  ) {}
}

/**
 * 停用标签命令
 */
export class DeactivateTagCommand {
  constructor(
    public readonly tagId: string,
    public readonly userId: string,
    public readonly releaseBit: boolean = false,
    public readonly reason?: string
  ) {}
}

/**
 * 废弃标签命令
 */
export class DeprecateTagCommand {
  constructor(
    public readonly tagId: string,
    public readonly userId: string,
    public readonly reason?: string
  ) {}
}

/**
 * 恢复标签命令
 */
export class ResumeTagCommand {
  constructor(
    public readonly tagId: string,
    public readonly userId: string
  ) {}
}

/**
 * 删除标签命令
 */
export class DeleteTagCommand {
  constructor(
    public readonly tagId: string,
    public readonly userId: string
  ) {}
}

/**
 * 更新标签规则命令
 */
export class UpdateTagRuleCommand {
  constructor(
    public readonly tagId: string,
    public readonly rule: {
      ruleType: string;
      ruleContent?: string;
      steps?: Array<{ order: number; sql: string }>;
      dataModelIds?: string[];
    },
    public readonly userId: string
  ) {}
}

/**
 * 更新标签周期命令
 */
export class UpdateTagCycleCommand {
  constructor(
    public readonly tagId: string,
    public readonly cycle: string,
    public readonly userId: string
  ) {}
}

/**
 * 重建 MV 命令
 */
export class RebuildMvCommand {
  constructor(
    public readonly tagId: string,
    public readonly userId: string
  ) {}
}

/**
 * 重建 MV 结果
 */
export class RebuildMvResult {
  constructor(
    public readonly success: boolean,
    public readonly mvNames: string[] = [],
    public readonly tableNames: string[] = [],
    public readonly error?: string
  ) {}
}

/**
 * 激活标签结果
 */
export class ActivateTagResult {
  constructor(
    public readonly success: boolean,
    public readonly mvNames: string[] = [],
    public readonly targetTableNames: string[] = [],
    public readonly bitPosition?: number,
    public readonly bitmapTableId?: string,
    public readonly error?: string
  ) {}
}

/**
 * 标签激活应用服务接口
 *
 * 架构说明:
 * 1. 处理标签的生命周期操作
 * 2. 协调领域服务和基础设施
 * 3. 处理事务和回滚
 */
export interface ITagActivationApplicationService {
  /**
   * 激活标签
   * 创建物化视图，开始计算
   */
  activateTag(command: ActivateTagCommand): Promise<ActivateTagResult>;

  /**
   * 停用标签
   * 暂停物化视图刷新
   */
  deactivateTag(command: DeactivateTagCommand): Promise<void>;

  /**
   * 恢复标签
   * 恢复物化视图刷新
   */
  resumeTag(command: ResumeTagCommand): Promise<void>;

  /**
   * 删除标签
   * 删除 MV + 清理数据
   */
  deleteTag(command: DeleteTagCommand): Promise<void>;

  /**
   * 更新标签规则
   * 重建 MV（Bitmap 位复用）
   */
  updateTagRule(command: UpdateTagRuleCommand): Promise<void>;

  /**
   * 更新标签周期
   * 删除旧 MV + 重建
   */
  updateTagCycle(command: UpdateTagCycleCommand): Promise<void>;

  /**
   * 废弃标签
   * 将标签状态设为 DEPRECATED
   */
  deprecateTag(command: DeprecateTagCommand): Promise<void>;

  /**
   * 重建 MV
   * 根据当前版本重建物化视图（幂等操作）
   */
  rebuildMv(command: RebuildMvCommand): Promise<RebuildMvResult>;
}


