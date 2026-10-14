import {SegmentMember} from '@/modules/segment/domain/entities/index';
import {SegmentMemberFilter} from '@/modules/segment/domain/commands/SegmentMemberFilter';

/**
 * 分群成员领域服务接口
 */
export interface SegmentMemberDomainService {
    /**
     * 获取分群成员
     * @param segmentId 分群ID
     * @param filter 过滤条件
     */
    getMembers(segmentId: string, filter?: SegmentMemberFilter): Promise<SegmentMember[]>;

    /**
     * 获取成员数量
     * @param segmentId 分群ID
     */
    getMemberCount(segmentId: string): Promise<number>;

    /**
     * 检查成员资格
     * @param segmentId 分群ID
     * @param entityId 实体ID
     */
    isMember(segmentId: string, entityId: string): Promise<boolean>;

    /**
     * 导出成员
     * @param segmentId 分群ID
     * @param format 导出格式
     */
    exportMembers(segmentId: string, format: 'csv' | 'json'): Promise<Buffer>;
}
