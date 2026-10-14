import {SegmentDomainService} from '@/modules/segment/domain/services/ports/SegmentDomainService';
import {Segment} from '@/modules/segment/domain/entities/Segment';
import {SegmentCondition, SegmentConditionGroup} from '@/modules/segment/domain/value-objects/index';
import {SegmentCreateCommand} from '@/modules/segment/contracts/commands/index';
import {SegmentUpdateCommand} from '@/modules/segment/contracts/commands/index';
import {SegmentDeleteCommand} from '@/modules/segment/domain/commands/SegmentDeleteCommand';
import {SegmentRepository} from '@/modules/segment/domain/ports/SegmentRepository';
import type {TagQueryDomainService} from '@/modules/tag/contracts';
import {SegmentFactory} from '@/modules/segment/domain/factories/index';
import {SegmentStatus} from '@/shared/enums/index';

/**
 * 分群领域服务实现
 * @description 负责分群聚合根的生命周期管理
 */
export class SegmentDomainServiceImpl implements SegmentDomainService {
    constructor(
        private readonly segmentRepository: SegmentRepository,
        private readonly segmentFactory: SegmentFactory,
        private readonly tagQueryDomainService: TagQueryDomainService
    ) {
    }

    /**
     * 创建分群
     * @precondition 分群名称必须唯一（建议）
     * @postcondition 分群被持久化保存
     * @param command 创建命令
     */
    async createSegment(command: SegmentCreateCommand): Promise<Segment> {
        const existingSegment = await this.segmentRepository.findByName(command.name);
        if (existingSegment) {
            throw new Error(`分群名称 "${command.name}" 已存在`);
        }

        const segment = this.segmentFactory.createSegment(command);

        await this.segmentRepository.save(segment);
        return segment;
    }

    /**
     * 更新分群
     * @precondition 分群必须存在
     * @postcondition 分群属性被更新并持久化
     * @param command 更新命令
     */
    async updateSegment(command: SegmentUpdateCommand): Promise<Segment> {
        const segment = await this.segmentRepository.findById(command.id);
        if (!segment) {
            throw new Error(`分群不存在: ID "${command.id}"`);
        }

        if (command.name) {
            const existingName = await this.segmentRepository.findByName(command.name);
            if (existingName && existingName.id !== command.id) {
                throw new Error(`分群名称 "${command.name}" 已存在`);
            }
            segment.name = command.name;
        }

        if (command.description !== undefined) segment.description = command.description;
        if (command.status) segment.status = command.status;
        if (command.conditionGroup) {
            await this.validateConditions(command.conditionGroup as SegmentConditionGroup);
            segment.conditionGroup = command.conditionGroup as SegmentConditionGroup;
        }

        await this.segmentRepository.save(segment);
        return segment;
    }

    /**
     * 删除分群
     * @precondition 分群必须存在
     * @postcondition 分群被移除
     * @param command 删除命令
     */
    async deleteSegment(command: SegmentDeleteCommand): Promise<void> {
        const segment = await this.segmentRepository.findById(command.id);
        if (!segment) {
            throw new Error(`分群不存在: ID "${command.id}"`);
        }
        await this.segmentRepository.remove(command.id);
    }

    /**
     * 激活分?
     * @precondition 分群必须存在
     * @postcondition 分群状态变?ACTIVE
     */
    async activateSegment(id: string): Promise<Segment> {
        const segment = await this.segmentRepository.findById(id);
        if (!segment) {
            throw new Error(`分群不存在: ID "${id}"`);
        }
        segment.status = SegmentStatus.ACTIVE;
        await this.segmentRepository.save(segment);
        return segment;
    }

    /**
     * 禁用分群
     * @precondition 分群必须存在
     * @postcondition 分群状态变?INACTIVE
     */
    async deactivateSegment(id: string): Promise<Segment> {
        const segment = await this.segmentRepository.findById(id);
        if (!segment) {
            throw new Error(`分群不存在: ID "${id}"`);
        }
        segment.status = SegmentStatus.INACTIVE;
        await this.segmentRepository.save(segment);
        return segment;
    }

    /**
     * 验证分群条件中的标签是否存在
     * @param group 条件组
     */
    private async validateConditions(group: SegmentConditionGroup): Promise<void> {
        const tagIds = this.extractTagIds(group);
        if (tagIds.length === 0) return;

        // 去重
        const uniqueTagIds = Array.from(new Set(tagIds));
        const tags = await this.tagQueryDomainService.getTagsByIds(uniqueTagIds);

        if (tags.length !== uniqueTagIds.length) {
            const foundIds = tags.map(t => t.id);
            const missingIds = uniqueTagIds.filter(id => !foundIds.includes(id));
            throw new Error(`标签不存在: ${missingIds.join(', ')}`);
        }
    }

    /**
     * 递归提取条件组中的所有标签ID
     * @param group 条件组
     */
    private extractTagIds(group: SegmentConditionGroup): string[] {
        let ids: string[] = [];
        if (!group || !group.conditions) return ids;

        for (const condition of group.conditions) {
            if ('tagId' in condition) {
                ids.push((condition as SegmentCondition).tagId);
            } else {
                ids = ids.concat(this.extractTagIds(condition as SegmentConditionGroup));
            }
        }
        return ids;
    }
}
