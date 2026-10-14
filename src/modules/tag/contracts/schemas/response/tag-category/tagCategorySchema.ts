import {z} from 'zod';
import {featureSchema} from '@/shared/schemas/common/featureSchema';
import {JsonValue} from '@/shared/types/jsonValue';

export interface TagCategoryVO {
    id: string;
    name: string;
    parent?: { id: string } | TagCategoryVO | null;
    path: string;
    description?: string;
    orderIndex: number;
    tagCount: number;
    childrenCount?: number;
    feature?: JsonValue | null;
    isDeleted: boolean;
    createTime: string;
    updateTime?: string;
    deleteTime?: string;
    createdBy?: string;
    updatedBy?: string;
    deletedBy?: string;
    children?: TagCategoryVO[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tagCategorySchema: z.ZodType<TagCategoryVO, any, any> = z.lazy(() => {
    const schema = z.strictObject({
        id: z.uuid().describe('唯一标识符'),
        name: z.string().trim().describe('分类名称'),
        parent: z.lazy(() => schema).optional().nullable().describe('父分类对象'),
        path: z.string().trim().describe('分类路径'),
        description: z.string().trim().optional().describe('分类描述'),
        orderIndex: z.int().describe('排序索引'),
        tagCount: z.int().describe('标签数量'),
        childrenCount: z.int().optional().describe('子分类数量'),
        feature: featureSchema,
        isDeleted: z.boolean().describe('是否删除'),
        createTime: z.iso.datetime().describe('创建时间'),
        updateTime: z.iso.datetime().optional().describe('更新时间'),
        deleteTime: z.iso.datetime().optional().describe('删除时间'),
        createdBy: z.uuid().optional().describe('创建人ID'),
        updatedBy: z.uuid().optional().describe('更新人ID'),
        deletedBy: z.uuid().optional().describe('删除人ID'),
        children: z.array(z.lazy(() => schema)).default([]).describe('子分类列表'),
    }) as z.ZodType<TagCategoryVO, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    return schema;
});
