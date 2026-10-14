import {Feature} from "@/shared/types/feature";

/**
 * 创建标签分类命令
 */
export interface CreateTagCategoryCommand {
    name: string;
    parentId?: string;
    description: string;
    orderIndex: number;
    feature?: Feature;
    createdBy: string;
    ownedBy?: string;
}

/**
 * 更新标签分类命令
 */
export interface UpdateTagCategoryCommand {
    categoryId: string;
    name?: string;
    parentId?: string;
    description?: string;
    orderIndex?: number;
    feature?: Feature;
    updatedBy: string;
    ownedBy?: string;
}

/**
 * 删除标签分类命令
 */
export interface DeleteTagCategoryCommand {
    categoryId: string;
    deletedBy: string;
    ownedBy?: string;
}

/**
 * 移动标签分类命令
 */
export interface MoveTagCategoryCommand {
    categoryId: string;
    newParentId: string;
    updatedBy: string;
    ownedBy?: string;
}

/**
 * 重新排序标签分类命令
 */
export interface ReorderTagCategoriesCommand {
    categoryIds: string[];
    orderIndex: number[];
    updatedBy: string;
    ownedBy?: string;
}

export interface BatchDeleteTagCategoriesCommand {
    ids: string[];
    deletedBy: string;
    ownedBy?: string;
}

export interface BatchDeleteFailedItem {
    id: string;
    name: string;
    reason: string;
}

export interface BatchDeleteResult {
    success: boolean;
    deletedCount: number;
    message?: string;
    failedItems?: BatchDeleteFailedItem[];
}
