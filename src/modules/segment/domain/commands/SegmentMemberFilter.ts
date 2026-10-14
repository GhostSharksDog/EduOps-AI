import {SegmentType} from '@/shared/enums/index';
import {PaginationQueryDTO} from '@/shared/schemas/common/index';

/**
 * 分群成员查询过滤条件
 */
export interface SegmentMemberFilter {
    /** 成员类型 */
    memberType?: SegmentType;

    /** 加入时间之后 */
    joinedAfter?: Date;

    /** 加入时间之前 */
    joinedBefore?: Date;

    /** 分页参数 */
    pagination?: PaginationQueryDTO;
}
