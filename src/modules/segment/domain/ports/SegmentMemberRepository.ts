import {SegmentMember} from '@/modules/segment/domain/entities/SegmentMember';
import {SegmentMemberFilter} from '@/modules/segment/domain/commands/SegmentMemberFilter';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 分页结果
 */
export interface Page<T> {
    /**
     * 分页数据
     */
    items: T[];
    /**
     * 总数量
     */
    total: number;
    /**
     * 当前页码
     */
    page: number;
    /**
     * 每页数量
     */
    pageSize: number;
}

/**
 * 分群成员仓库接口
 */
export interface SegmentMemberRepository {
    /**
     * 保存分群成员列表
     * @param segmentId 分群ID
     * @param members 分群成员列表
     * @param tenantFilter 租户过滤选项
     */
    saveMembers(segmentId: string, members: SegmentMember[], tenantFilter?: TenantFilterOptions): Promise<void>;

    /**
     * 清除分群所有成员
     * @param segmentId 分群ID
     * @param tenantFilter 租户过滤选项
     */
    clearMembers(segmentId: string, tenantFilter?: TenantFilterOptions): Promise<void>;

    /**
     * 查询分群成员
     * @param segmentId 分群ID
     * @param filter 查询过滤条件
     * @param tenantFilter 租户过滤选项
     * @returns 分页后的分群成员列表
     */
    findMembers(segmentId: string, filter: SegmentMemberFilter, tenantFilter?: TenantFilterOptions): Promise<Page<SegmentMember>>;

    /**
     * 统计分群成员数量
     * @param segmentId 分群ID
     * @param tenantFilter 租户过滤选项
     * @returns 分群成员数量
     */
    countMembers(segmentId: string, tenantFilter?: TenantFilterOptions): Promise<number>;

    /**
     * 检查是否为分群成员
     * @param segmentId 分群ID
     * @param entityId 实体ID
     * @param tenantFilter 租户过滤选项
     * @returns 是否为分群成员
     */
    isMember(segmentId: string, entityId: string, tenantFilter?: TenantFilterOptions): Promise<boolean>;
}