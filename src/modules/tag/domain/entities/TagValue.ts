import {TagValueStatus} from '@/shared/enums/tag/TagValueStatus';
import type {JsonValue} from "@/shared/types/jsonValue";

/**
 * 标签值接口
 *
 * 架构交互:
 * 1. 承载标签的具体业务数据（实体ID + 计算值）。
 * 2. 为 Segment (分群) 模块 `SegmentCondition` 的核心数据源。
 * 3. 分群计算引擎会根据 TagValue 的 `value` 进行筛选和聚合。
 */
export interface TagValue {
    id: string;
    tagId: string;
    entityId: string;
    value: JsonValue;
    calculatedAt: Date;
    calculatedVersion: string;
    status: TagValueStatus;
}
