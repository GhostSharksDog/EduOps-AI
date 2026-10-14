import {SegmentMember, SegmentMemberDomainService} from '@/modules/segment/domain/index';
import {SegmentMemberFilter} from '@/modules/segment/domain/commands/SegmentMemberFilter';
import {SegmentMemberRepository} from '@/modules/segment/domain/ports/SegmentMemberRepository';
import {SortOrder} from '@/shared/enums/index';

/**
 * 分群成员领域服务实现
 * @description 提供分群成员的查询和导出功能
 */
export class SegmentMemberDomainServiceImpl implements SegmentMemberDomainService {
    constructor(
        private readonly memberRepository: SegmentMemberRepository
    ) {
    }

    /**
     * 获取分群成员
     * @param segmentId 分群ID
     * @param filter 过滤条件
     */
    async getMembers(segmentId: string, filter?: SegmentMemberFilter): Promise<SegmentMember[]> {
        const query = {
            page: filter?.pagination?.page || 1,
            pageSize: filter?.pagination?.pageSize || 100,
            joinedAfter: filter?.joinedAfter,
            joinedBefore: filter?.joinedBefore
        };

        const result = await this.memberRepository.findMembers(segmentId, query);
        return result.items;
    }

    /**
     * 获取成员数量
     * @param segmentId 分群ID
     */
    async getMemberCount(segmentId: string): Promise<number> {
        return this.memberRepository.countMembers(segmentId);
    }

    /**
     * 检查成员资格
     * @param segmentId 分群ID
     * @param entityId 实体ID
     */
    async isMember(segmentId: string, entityId: string): Promise<boolean> {
        return this.memberRepository.isMember(segmentId, entityId);
    }

    /**
     * 导出成员
     * @param segmentId 分群ID
     * @param format 导出格式
     */
    async exportMembers(segmentId: string, format: 'csv' | 'json'): Promise<Buffer> {
        const query = {
            pagination: {
                page: 1,
                pageSize: 10000,
                sortOrder: SortOrder.ASC
            }
        };
        const result = await this.memberRepository.findMembers(segmentId, query);
        const members = result.items;

        let content = '';
        if (format === 'json') {
            content = JSON.stringify(members, null, 2);
        } else {
            content = 'MemberId,JoinMethod,JoinedAt\n';
            content += members.map((m: SegmentMember) => `${m.id},${m.joinMethod},${m.joinedAt.toISOString()}`).join('\n');
        }

        return Buffer.from(content);
    }
}
