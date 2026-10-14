import {SegmentCalculationType, SegmentStatus, SegmentType} from '@/shared/enums/index';
import {PaginationQueryDTO} from '@/shared/schemas/common/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 分群查询过滤条件
 * 用于领域层和仓储层的查询参数
 */
export interface SegmentFilter {
    ownedBy?: string;
    /** 分群名称（模糊匹配） */
    name?: string;

    /** 分群类型 */
    type?: SegmentType;

    /** 分群状态 */
    status?: SegmentStatus;

    /** 计算类型 */
    calculationType?: SegmentCalculationType;

    /** 创建者ID */
    createdBy?: string;

    /** 业务负责人 */
    businessOwner?: string;

    /** 分页参数 */
    pagination?: PaginationQueryDTO;

    /** 租户过滤 */
    tenantFilter?: TenantFilterOptions;
}
