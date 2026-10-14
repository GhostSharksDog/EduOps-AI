import {z} from 'zod';
import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import {extensibleBaseSchema} from '@/shared/schemas/common/index';
import {tagCategorySchema} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// Forward declaration for circular reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-const
let tagVersionSchema: z.ZodType<any>;

// Bit 配置 schema
const bitConfigSchema = z.object({
    bitmapTableId: z.string().uuid().describe('Bitmap 表 ID'),
    bitPosition: z.number().int().min(0).max(63).describe('Bit 位置 (0-63)'),
}).optional().describe('Bit 配置');

// 标签响应schema
export const tagSchema = extensibleBaseSchema.extend({
    name: z.string().trim().min(1, '标签名称不能为空').describe('标签名称'),
    category: z.lazy(() => tagCategorySchema).nullable().describe('关联的标签分类对象'),
    dataType: z.enum(TagValueType, {
        message: '标签值类型无效'
    }).describe('标签值类型'),
    status: z.enum(TagStatus, {
        message: '标签状态无效'
    }).describe('标签状态'),
    updateCycle: z.enum(UpdateCycle, {
        message: '更新周期无效'
    }).describe('更新周期'),
    isPublic: z.boolean().describe('是否公开'),
    feature: featureSchema,
    bitConfig: bitConfigSchema.optional().describe('Bit 配置'),
    currentVersion: z.lazy(() => tagVersionSchema).optional().describe('当前版本信息'),
    isDeleted: z.boolean().describe('是否删除'),
    targetTableId: z.string().uuid().optional().nullable().describe('关联的目标表ID（反向存储在TargetTable.tagId）'),
    createTime: z.iso.datetime().describe('创建时间'),
    updateTime: z.iso.datetime().optional().describe('更新时间'),
    deleteTime: z.iso.datetime().optional().describe('删除时间'),
    createdBy: z.uuid().optional().describe('创建人ID'),
    updatedBy: z.uuid().optional().describe('更新人ID'),
    deletedBy: z.uuid().optional().describe('删除人ID'),
});

// Import and assign after declaration to break circular reference
import {tagVersionSchema as _tagVersionSchema} from '@/modules/tag/contracts/schemas/response/tag/tagVersionSchema';
tagVersionSchema = _tagVersionSchema;

// 导出类型（VO后缀，符合响应Schema规范）
export type TagVO = z.infer<typeof tagSchema>;
