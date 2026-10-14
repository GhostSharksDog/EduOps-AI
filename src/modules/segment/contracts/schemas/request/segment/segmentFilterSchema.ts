import {z} from 'zod';
import {SegmentCalculationType, SegmentStatus, SegmentType} from '@/shared/enums/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export const segmentFilterSchema = z.strictObject({
    id: z.uuid('分群ID必须是有效的UUID').optional().describe('分群ID'),
    page: z.number().int().min(1).default(1).optional().describe('页码'),
    pageSize: z.number().int().min(1).default(20).optional().describe('每页条数'),
    name: z.string().trim().optional().describe('分群名称'),
    type: z.enum(SegmentType).optional().describe('分群类型'),
    status: z.enum(SegmentStatus).optional().describe('分群状态'),
    calculationType: z.enum(SegmentCalculationType).optional().describe('计算类型'),
    createdBy: z.uuid('创建人ID必须是有效的UUID').optional().describe('创建人ID'),
    ownedBy: z.uuid('当前所有者ID必须是有效的UUID').optional().describe('当前所有者ID'),
    businessOwner: z.uuid('业务负责人ID必须是有效的UUID').optional().describe('业务负责人'),
    tenantFilter: z.custom<TenantFilterOptions>().optional()
});

export type SegmentFilterDTO = z.infer<typeof segmentFilterSchema>;
