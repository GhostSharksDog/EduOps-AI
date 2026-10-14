import {z} from 'zod';
import {TagValueType, UpdateCycle} from '@/shared/enums/index';
import {tagRuleSchema} from '@/modules/tag/contracts/schemas/request/tag/tagRuleSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// Bit 配置 schema
const bitConfigSchema = z.object({
    bitmapTableId: z.string().uuid('Bitmap 表 ID 必须有效的 UUID').describe('Bitmap 表 ID'),
    bitPosition: z.number().int().min(0).max(63, 'Bit 位置必须在 0-63 之间').describe('Bit 位置 (0-63)'),
}).optional().describe('Bit 配置');

// 更新标签schema
export const updateTagSchema = z.strictObject({
    id: z.uuid('标签ID必须是有效的UUID').describe('标签ID'),
    name: z.string().trim().min(1, '标签名称不能为空').max(255, '标签名称不能超过255个字符').optional().describe('标签名称'),
    dataType: z.enum(TagValueType).optional().describe('标签值类型'),
    categoryId: z.uuid('分类ID必须是有效的UUID').describe('所属分类ID（必填，每个标签必须归属于一个分类）'),
    description: z.string().trim().optional().describe('标签描述'),
    isPublic: z.boolean().optional().describe('是否公开'),
    updateCycle: z.enum(UpdateCycle).optional().describe('更新周期'),
    targetTableId: z.string().uuid().optional().nullable().describe('关联的目标表ID（可选，用于修改关联；传入null可取消关联）'),
    rule: tagRuleSchema.optional().describe('计算规则'),
    feature: featureSchema,
    bitConfig: bitConfigSchema,
});

// 导出TypeScript类型
export type UpdateTagDTO = z.infer<typeof updateTagSchema>;