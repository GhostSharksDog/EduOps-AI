/**
 * TagRefreshLog 实体
 *
 * 记录 MV 刷新异常，用于监控和告警
 */
export class TagRefreshLog {
  constructor(
    public id: string,
    public tagId: string,
    public mvName: string,
    public ownedBy: string,
    public errorMessage?: string,
    public occurredAt: Date = new Date(),
    public isResolved: boolean = false,
    public createTime: Date = new Date()
  ) {}

  /**
   * 标记为已解决
   */
  markResolved(): void {
    this.isResolved = true;
  }

  /**
   * 检查是否为严重错误
   */
  isSevere(): boolean {
    if (!this.errorMessage) return false;
    const msg = this.errorMessage;
    const severeKeywords = ['stale', 'failed', 'error', 'exception'];
    return severeKeywords.some((k) => msg.toLowerCase().includes(k));
  }

  /**
   * 获取错误摘要
   */
  getErrorSummary(): string {
    if (!this.errorMessage) return '未知错误';
    return this.errorMessage.length > 200
      ? this.errorMessage.substring(0, 200) + '...'
      : this.errorMessage;
  }

  /**
   * 判断是否需要告警
   * 未解决且有错误信息时需要告警
   */
  needsAlert(): boolean {
    return !this.isResolved && !!this.errorMessage;
  }

  /**
   * 从数据对象创建实体
   */
  static fromData(data: {
    id: string;
    tagId: string;
    mvName: string;
    ownedBy: string;
    errorMessage?: string;
    occurredAt: Date;
    isResolved: boolean;
    createTime: Date;
  }): TagRefreshLog {
    return new TagRefreshLog(
      data.id,
      data.tagId,
      data.mvName,
      data.ownedBy,
      data.errorMessage,
      data.occurredAt,
      data.isResolved,
      data.createTime
    );
  }

  /**
   * 转换为数据对象
   */
  toData(): {
    id: string;
    tagId: string;
    mvName: string;
    ownedBy: string;
    errorMessage?: string;
    occurredAt: Date;
    isResolved: boolean;
    createTime: Date;
  } {
    return {
      id: this.id,
      tagId: this.tagId,
      mvName: this.mvName,
      ownedBy: this.ownedBy,
      errorMessage: this.errorMessage,
      occurredAt: this.occurredAt,
      isResolved: this.isResolved,
      createTime: this.createTime,
    };
  }
}
