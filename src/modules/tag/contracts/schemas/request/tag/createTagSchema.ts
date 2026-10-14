import {z} from 'zod';
import {TagValueType, UpdateCycle} from '@/shared/enums/index';
import {tagRuleSchema} from '@/modules/tag/contracts/schemas/request/tag/tagRuleSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// Bit 配置 schema
const bitConfigSchema = z.object({
    bitmapTableId: z.string().uuid().describe('Bitmap 表 ID'),
    bitPosition: z.number().int().min(0).max(63).describe('Bit 位置 (0-63)'),
}).optional().describe('Bit 配置');

// 枚举值列表 schema（仅 ENUM 类型有效）
const enumValuesSchema = z.array(z.string().trim().min(1, '枚举值不能为空')).min(1, '至少需要一个枚举值');

// 创建标签schema
export const createTagSchema = z.strictObject({
    name: z.string().trim().min(1, '标签名称不能为空').max(255, '标签名称不能超过255个字符').describe('标签名称'),
    dataType: z.enum(TagValueType).describe('标签值类型'),
    categoryId: z.uuid('分类ID必须是有效的UUID').describe('所属分类ID'),
    description: z.string().trim().optional().describe('标签描述'),
    isPublic: z.boolean().default(false).describe('是否公开'),
    ownedBy: z.uuid('所属者ID必须是有效的UUID').optional().describe('所属者ID'),
    updateCycle: z.enum(UpdateCycle).optional().describe('更新周期'),
    rule: tagRuleSchema.optional().describe('计算规则'),
    version: z.strictObject({
        version: z.string().trim().describe('版本号'),
        description: z.string().trim().optional().describe('版本描述')
    }).optional().describe('初始版本信息'),
    feature: featureSchema.default({}),
    targetTableId: z.string().uuid().optional().describe('关联的目标表ID'),
    bitConfig: bitConfigSchema.optional().describe('Bit 配置'),
    enumValues: enumValuesSchema.optional().describe('枚举值列表（仅 ENUM 类型时有效）'),
});

// 导出类型（DTO 后缀，符合请求 Schema 规范）
export type CreateTagDTO = z.infer<typeof createTagSchema>;