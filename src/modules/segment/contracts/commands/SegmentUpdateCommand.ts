import {Feature} from "@/shared/types/feature";
import {SegmentStatus} from "@/shared/enums/index";
import type {SegmentConditionGroupDTO} from "@/modules/segment/contracts/schemas/request/segment/segmentConditionGroupSchema";

/**
 * 更新分群命令
 */
export interface SegmentUpdateCommand {
    /** 分群ID */
    id: string;

    /** 分群名称 */
    name?: string;

    /** 分群描述 */
    description?: string;

    /** 条件组合 */
    conditionGroup?: SegmentConditionGroupDTO;

    /** 计算类型 */
    calculationType?: string;

    /** 调度配置 */
    calculationSchedule?: string;

    /** 扩展特性 */
    feature?: Feature;

    /** 分群状态 */
    status?: SegmentStatus;

    /** 更新人ID */
    updatedBy: string;

    /** 租户ID */
    ownedBy?: string;
}
