import {Feature} from "@/shared/types/feature";
import {SegmentType} from "@/shared/enums/index";
import type {SegmentConditionGroupDTO} from "@/modules/segment/contracts/schemas/request/segment/segmentConditionGroupSchema";

/**
 * 创建分群命令
 */
export interface SegmentCreateCommand {
    name: string;
    type: SegmentType;
    calculationType: string;
    conditionGroup: SegmentConditionGroupDTO;
    description?: string;
    calculationSchedule?: string;
    feature?: Feature;
    createdBy: string;
    ownedBy?: string;
}
