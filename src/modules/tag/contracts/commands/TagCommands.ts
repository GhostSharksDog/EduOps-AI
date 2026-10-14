import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import {RuleType} from '@/shared/enums/tag/RuleType';
import {Feature} from "@/shared/types/feature";

/**
 * 创建标签命令
 */
export interface CreateTagCommand {
    name: string;
    valueType: TagValueType;
    categoryId: string;
    description?: string;
    updateCycle?: UpdateCycle;
    feature?: Feature;
    createdBy: string;
    ownedBy?: string;
    isPublic?: boolean;
    targetTableId?: string;
    /**
     * Bit 配置（仅适用于 Boolean 类型标签）
     */
    bitConfig?: {
        bitmapTableId: string;
        bitPosition: number;
    };
    version?: {
        version: string;
        description?: string;
    };
    rule?: {
        ruleType: RuleType;
        ruleContent?: string;
        steps?: Array<{ order: number; sql: string }>;
        dataModelIds: string[];
        feature?: Feature;
    };
    /** ENUM 类型标签的枚举值列表 */
    enumValues?: string[];
}

/**
 * 更新标签命令
 */
export interface UpdateTagCommand {
    tagId: string;
    name?: string;
    valueType?: TagValueType;
    categoryId?: string;
    description?: string;
    updateCycle?: UpdateCycle;
    feature?: Feature;
    isPublic?: boolean;
    updatedBy: string;
    ownedBy?: string;
    targetTableId?: string | null;
    bitConfig?: {
        bitmapTableId: string;
        bitPosition: number;
    }
    rule?: {
        ruleType: RuleType;
        ruleContent?: string;
        steps?: Array<{ order: number; sql: string; targetTableId?: string }>;
        dataModelIds: string[];
    }
}

/**
 * 更新标签状态命令
 */
export interface UpdateTagStatusCommand {
    tagId: string;
    status: TagStatus;
    updatedBy: string;
    ownedBy?: string;
}

/**
 * 删除标签命令
 */
export interface DeleteTagCommand {
    tagId: string;
    deletedBy: string;
    ownedBy?: string;
}

/**
 * 创建标签版本命令
 */
export interface CreateTagVersionCommand {
    tagId: string;
    version: number;
    rule?: {
        ruleType: RuleType;
        ruleContent?: string;
        steps?: Array<{ order: number; sql: string }>;
        dataModelIds: string[];
        feature?: Feature;
    };
    enumValues?: string[];
    description?: string;
    name?: string;
    createdBy: string;
    ownedBy?: string;
}

/**
 * 设置当前版本命令
 */
export interface SetCurrentVersionCommand {
    tagId: string;
    versionId: string;
    updatedBy: string;
    ownedBy?: string;
}
