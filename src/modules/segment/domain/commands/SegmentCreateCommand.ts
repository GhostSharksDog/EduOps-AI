import {SegmentCalculationType, SegmentType} from '@/shared/enums/index';
import {SegmentConditionGroup} from '@/modules/segment/domain/value-objects/index';
import {Feature} from "@/shared/types/feature";

/**
 * 分群创建命令
 * 领域层输入参数
 */
export interface SegmentCreateCommand {
    /** 分群名称 */
    name: string;

    /** 当前所有者ID */
    ownedBy: string;

    /** 分群描述 */
    description?: string;

    /** 实体类型：USER(用户), DEVICE(设备) */
    entityType: SegmentType;

    /** 计算类型：REALTIME(实时), OFFLINE(离线) */
    calculationType: SegmentCalculationType;

    /** 调度配置（如Cron表达式） */
    scheduleConfig?: Feature;

    /** 条件组合 */
    conditionGroup?: SegmentConditionGroup;

    /** 标签列表 */
    tags?: string[];

    /** 业务负责人ID */
    businessOwner?: string;

    /** 技术负责人ID */
    technicalOwner?: string;

    /** 扩展特性 */
    feature?: Feature;

    /** 创建人ID */
    createdBy?: string;
}
