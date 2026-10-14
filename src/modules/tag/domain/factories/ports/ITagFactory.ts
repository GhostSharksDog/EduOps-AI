import {Tag, TagCategory, TagVersion} from '@/modules/tag/domain/index';
import {CreateTagCommand} from '@/modules/tag/contracts/commands/TagCommands';
import {CreateTagVersionCommand} from '@/modules/tag/contracts/commands/TagCommands';
import {CreateTagCategoryCommand} from '@/modules/tag/contracts/commands/TagCategoryCommands';

/**
 * 标签工厂接口
 */
export interface ITagFactory {
    /**
     * 创建标签
     * @param command 创建标签命令
     */
    createTag(command: CreateTagCommand): Tag;

    /**
     * 创建标签版本
     * @param command 创建标签版本命令
     */
    createTagVersion(command: CreateTagVersionCommand): TagVersion;

    /**
     * 创建标签分类
     * @param command 创建标签分类命令
     */
    createTagCategory(command: CreateTagCategoryCommand): TagCategory;
}
