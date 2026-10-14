import { ITagFactory } from '@/modules/tag/domain/factories/ports/ITagFactory';
import { Tag, TagCategory, TagVersion } from '@/modules/tag/domain/entities/index';
import { CreateTagCommand, CreateTagVersionCommand } from '@/modules/tag/contracts/commands/TagCommands';
import { CreateTagCategoryCommand } from '@/modules/tag/contracts/commands/TagCategoryCommands';
import { TagStatus, UpdateCycle } from '@/shared/enums/index';
import { config } from '@/platform/config/index';

export class TagFactoryImpl implements ITagFactory {
    createTag(command: CreateTagCommand): Tag {
    const now = new Date();
    const tagId = crypto.randomUUID();
    const ownedBy = command.ownedBy ?? config.system.userId;

    const versions: TagVersion[] = [];

    if (command.rule) {
        const initialVersion = new TagVersion(
            crypto.randomUUID(),
            tagId,
            ownedBy,
            now,
            command.createdBy ?? ownedBy,
            1,
            command.version?.version || 'v1.0.0',
            command.version?.description,
            false,
            command.rule.feature,
            now,
            undefined,
            undefined,
            undefined,
            true,
            undefined,
            JSON.stringify({
                ruleType: command.rule.ruleType || 'SQL',
                ruleContent: command.rule.ruleContent || '',
                dataModelIds: command.rule.dataModelIds || [],
                ...(command.rule.steps && { steps: command.rule.steps }),
            }),
            command.enumValues  // ENUM 类型标签的枚举值列表
        );
        versions.push(initialVersion);
    }

    return new Tag(
      tagId,
      command.name,
      command.valueType,
      TagStatus.DRAFT,
      command.updateCycle || UpdateCycle.DAILY,
      ownedBy,
      command.categoryId,
      now,
      command.createdBy ?? ownedBy,
      command.isPublic ?? false,
      command.description,
      undefined,
      command.feature,
      undefined,
      versions.length > 0 ? versions[0].id : undefined,
      versions.length > 0 ? versions[0] : undefined,
      versions,
      false,
      now,
      undefined,
      command.createdBy ?? ownedBy,
      undefined
    );
  }

  createTagVersion(command: CreateTagVersionCommand): TagVersion {
    const now = new Date();
    const ownedBy = command.ownedBy ?? config.system.userId;

    return new TagVersion(
      crypto.randomUUID(),
      command.tagId,
      ownedBy,
      now,
      command.createdBy ?? ownedBy,
      command.version || 1,
      command.name || `v${command.version || 1}.0.0`,
      undefined,
      false,
      undefined,
      now,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      JSON.stringify({
        ruleType: command.rule?.ruleType || 'SQL',
        ruleContent: command.rule?.ruleContent || '',
        dataModelIds: command.rule?.dataModelIds || [],
        ...(command.rule?.steps && { steps: command.rule.steps }),
      }),
      command.enumValues
    );
  }

  createTagCategory(command: CreateTagCategoryCommand): TagCategory {
    const now = new Date();
    const categoryId = crypto.randomUUID();
    const ownedBy = command.ownedBy ?? config.system.userId;

    return new TagCategory(
      categoryId,
      command.name,
      command.parentId ? `${command.parentId}/${categoryId}` : categoryId,
      command.orderIndex,
      ownedBy,
      now,
      command.createdBy ?? ownedBy,
      0,
      command.feature,
      command.parentId,
      undefined,
      command.description,
      [],
      false,
      now,
      undefined,
      command.createdBy ?? ownedBy,
      undefined
    );
  }
}
