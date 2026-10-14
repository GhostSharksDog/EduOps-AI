import { TagVersionAdapter } from '@/modules/tag/repositories/TagVersionAdapter';
import { TagVersion } from '@/modules/tag/domain/entities/TagVersion';
import { TagVersionPO } from '@/modules/tag/repositories/persistence/TagVersionPO';
import { TagValueType } from '@/shared/enums/index';

/**
 * 标签版本适配器实现
 */
export class TagVersionAdapterImpl implements TagVersionAdapter {
  /**
   * 将标签版本持久化对象转换为领域实体
   * @param tagVersionPO 标签版本持久化对象
   * @returns 标签版本领域实体
   */
  fromPOToTagVersionEntity(tagVersionPO: TagVersionPO): TagVersion {
    return new TagVersion(
      tagVersionPO.id,
      tagVersionPO.tagId,
      tagVersionPO.ownedBy,
      tagVersionPO.createTime,
      tagVersionPO.createdBy,
      tagVersionPO.version, // version (number 类型)
      tagVersionPO.name || undefined,
      tagVersionPO.description || undefined,
      tagVersionPO.isDeleted,
      tagVersionPO.feature,
      tagVersionPO.updateTime || undefined,
      tagVersionPO.deleteTime || undefined,
      tagVersionPO.updatedBy || undefined,
      tagVersionPO.deletedBy || undefined,
      tagVersionPO.isCurrent || false,
      this.parseRuleFromCalculationRule(tagVersionPO.calculationRule),
      typeof tagVersionPO.calculationRule === 'string'
        ? tagVersionPO.calculationRule
        : JSON.stringify(tagVersionPO.calculationRule || {}),
      // ENUM 枚举值列表
      (tagVersionPO.enumValues) as string[] | undefined ?? undefined
      // status 已删除 - 状态只在 Tag 级别管理
    );
  }

  /**
   * 将标签版本领域实体转换为持久化对象
   * @param tagVersion 标签版本领域实体
   * @returns 标签版本持久化对象
   */
  fromTagVersionEntityToPO(tagVersion: TagVersion): TagVersionPO {
    const calculationRule = tagVersion.rule 
      ? (typeof tagVersion.rule === 'string' ? JSON.parse(tagVersion.rule as string) : tagVersion.rule)
      : (typeof tagVersion.calculationRule === 'string' 
          ? JSON.parse(tagVersion.calculationRule) 
          : tagVersion.calculationRule || { dataModelIds: [] });
    
    return {
      id: tagVersion.id,
      tagId: tagVersion.tagId,
      version: tagVersion.version,
      description: tagVersion.description || null,
      isCurrent: tagVersion.isCurrent,
      feature: tagVersion.feature,
      isDeleted: tagVersion.isDeleted,
      createTime: tagVersion.createTime,
      updateTime: tagVersion.updateTime,
      deleteTime: tagVersion.deleteTime,
      createdBy: tagVersion.createdBy,
      updatedBy: tagVersion.updatedBy,
      deletedBy: tagVersion.deletedBy,
      name: tagVersion.name || null,
      ownedBy: tagVersion.ownedBy,
      value_type: TagValueType.STRING,
      calculationRule,
      enumValues: tagVersion.enumValues ?? [],
    } as TagVersionPO;
  }

  private parseRuleFromCalculationRule(calculationRule: unknown): { ruleType: string; ruleContent?: string; dataModelIds?: string[] } | undefined {
    if (!calculationRule) return undefined;
    const rule = typeof calculationRule === 'string' ? JSON.parse(calculationRule) : calculationRule;
    if (!rule || !rule.ruleType) return undefined;
    return {
      ruleType: rule.ruleType,
      ruleContent: rule.ruleContent,
      dataModelIds: rule.dataModelIds,
    };
  }
}
