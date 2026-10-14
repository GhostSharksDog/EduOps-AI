import { Tag } from '@/modules/tag/domain/entities/Tag';
import { TagStatus } from '@/shared/enums/index';
import { Feature } from '@/shared/types/feature';

/**
 * 标签规则接口
 */
export interface TagRule {
  id?: string
  name?: string
  description?: string
  ownedBy?: string
  isDeleted?: boolean
  feature?: Feature
  createTime?: Date
  updateTime?: Date
  deleteTime?: Date
  createdBy?: string
  updatedBy?: string
  deletedBy?: string
  tag?: Tag
  ruleType?: string
  ruleContent?: string
  dataModelIds?: string[]
}

/**
 * 标签版本实体类
 * 对应 Schema: src/shared/schemas/response/tag.ts::tagVersionSchema
 */
export class TagVersion {
  constructor(
    public id: string,
    public tagId: string,
    public ownedBy: string,
    public createTime: Date,
    public createdBy: string,
    public version: number, // 移到前面 - 必需参数
    public name?: string,
    public description?: string,
    public isDeleted: boolean = false,
    public feature?: Feature,
    public updateTime?: Date,
    public deleteTime?: Date,
    public updatedBy?: string,
    public deletedBy?: string,
    public isCurrent: boolean = false,
    public rule?: TagRule,
    public calculationRule?: string, // 新增: JSON 计算规则
    public enumValues?: string[] // ENUM 类型标签的枚举值列表
  ) {}

  public activate(): void {
    this.isCurrent = true;
    this.updateTime = new Date();
  }

  public deactivate(): void {
    this.isCurrent = false;
    this.updateTime = new Date();
  }

  // 别名方法 - 用于 Tag 实体调用
  public setAsCurrent(): void {
    this.activate();
  }

  public unsetAsCurrent(): void {
    this.deactivate();
  }

  public updateRule(rule: Partial<TagRule>): void {
    if (this.rule) {
      this.rule = { ...this.rule, ...rule };
    } else {
      this.rule = rule as TagRule;
    }
    this.updateTime = new Date();
  }

  public updateDescription(description: string): void {
    this.description = description;
    this.updateTime = new Date();
  }

  /**
   * 获取计算规则（解析 JSON）
   */
  public getCalculationRule(): {
    ruleType: string;
    ruleContent?: string;
    steps?: Array<{ order: number; sql: string }>;
    dataModelIds?: string[];
  } | null {
    if (!this.calculationRule) return null;
    try {
      return JSON.parse(this.calculationRule);
    } catch {
      return null;
    }
  }
}
