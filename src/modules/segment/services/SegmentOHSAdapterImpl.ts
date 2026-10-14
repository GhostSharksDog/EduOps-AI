import {NextRequest} from 'next/server';
import {Segment, SegmentMember} from '@/modules/segment/domain/entities/index';
import {type SegmentMemberVO, type SegmentVO} from '@/modules/segment/contracts/schemas/response/segment/index';
import {SegmentOHSAdapter} from '@/modules/segment/services/SegmentOHSAdapter';
import {SegmentFilter} from '@/modules/segment/domain/commands/SegmentFilter';
import {SegmentCreateCommand} from '@/modules/segment/contracts/commands/SegmentCreateCommand';
import {SegmentUpdateCommand} from '@/modules/segment/contracts/commands/SegmentUpdateCommand';
import {SegmentDeleteCommand} from '@/modules/segment/domain/commands/SegmentDeleteCommand';
import {SegmentStatus, SegmentType} from '@/shared/enums/index';
import {SortOrder} from '@/shared/enums/common/SortOrder';
import {getCurrentUserId} from '@/modules/identity/server';
import {createSegmentSchema} from '@/modules/segment/contracts/schemas/request/segment/createSegmentSchema';
import {updateSegmentSchema} from '@/modules/segment/contracts/schemas/request/segment/updateSegmentSchema';
import type {Feature} from '@/shared/types/feature';
import {z} from 'zod';
import {getCurrentTenantId, createTenantFilter} from '@/platform/get-current-tenant';

const paginationSchema = z.object({
    page: z.number().int().min(1, 'Page must be greater than or equal to 1'),
    pageSize: z.number().int().min(1, 'Page size must be greater than or equal to 1').max(10000, 'Page size must not exceed 10000'),
    sortOrder: z.nativeEnum(SortOrder)
});

/**
 * 分群模块 OHS 适配器实现
 */
export class SegmentOHSAdapterImpl implements SegmentOHSAdapter {

    /**
     * 将HTTP请求转换为列表查询对象
     * @param request HTTP请求对象
     * @returns SegmentFilter
     */
    public fromRequestToListSegmentsQuery(request: NextRequest): SegmentFilter {
        const searchParams = request.nextUrl.searchParams;
        
        const page = searchParams.get('page') ? parseInt(searchParams.get('page') || '1', 10) : 1;
        const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize') || '10', 10) : 10;
        
        const validatedPagination = paginationSchema.parse({
            page,
            pageSize,
            sortOrder: SortOrder.ASC
        });

        const tenantId = getCurrentTenantId(request);

        return {
            name: searchParams.get('name') || undefined,
            type: searchParams.get('type') as SegmentType || undefined,
            status: searchParams.get('status') as SegmentStatus || undefined,
            pagination: validatedPagination,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    /**
     * 将HTTP请求转换为获取单个分群查询
     * @param request HTTP请求对象
     * @param id 分群ID（从路由参数中获取）
     * @returns SegmentFilter
     */
    public fromRequestToGetSegmentQuery(request: NextRequest, id?: string): SegmentFilter {
        const tenantId = getCurrentTenantId(request);
        return {
            name: id || '',
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    /**
     * 将HTTP请求转换为创建命令
     * @param request HTTP请求对象
     * @returns Promise<SegmentCreateCommand>
     */
    public async fromRequestToCreateSegmentCommand(request: NextRequest): Promise<SegmentCreateCommand> {
        const body = await request.json();
        const validatedBody = createSegmentSchema.parse(body);
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return {
            name: validatedBody.name,
            type: validatedBody.entityType,
            calculationType: validatedBody.calculationType,
            conditionGroup: validatedBody.conditionGroup ?? {},
            description: validatedBody.description,
            calculationSchedule: validatedBody.scheduleConfig ? JSON.stringify(validatedBody.scheduleConfig) : undefined,
            feature: validatedBody.feature as Feature,
            createdBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为更新命令
     * @param request HTTP请求对象
     * @returns Promise<SegmentUpdateCommand>
     */
    public async fromRequestToUpdateSegmentCommand(request: NextRequest): Promise<SegmentUpdateCommand> {
        const searchParams = request.nextUrl.searchParams;
        const body = await request.json();
        const validatedBody = updateSegmentSchema.parse({...body, id: searchParams.get('id') || ''});
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return {
            id: validatedBody.id,
            name: validatedBody.name,
            description: validatedBody.description,
            conditionGroup: validatedBody.conditionGroup,
            calculationType: validatedBody.calculationType,
            calculationSchedule: validatedBody.scheduleConfig ? JSON.stringify(validatedBody.scheduleConfig) : undefined,
            feature: validatedBody.feature as Feature,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为删除命令
     * @param request HTTP请求对象
     * @returns SegmentDeleteCommand
     */
    public fromRequestToDeleteSegmentCommand(request: NextRequest): SegmentDeleteCommand {
        const searchParams = request.nextUrl.searchParams;
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        return {
            id: searchParams.get('id') || '',
            deletedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    fromSegmentToSegmentVO(segment: Segment): SegmentVO {
        return {
            id: segment.id,
            ownedBy: segment.ownedBy,
            isDeleted: segment.isDeleted,
            createTime: segment.createTime?.toISOString() || new Date().toISOString(),
            createdBy: segment.createdBy,
            updateTime: segment.updateTime?.toISOString() || undefined,
            updatedBy: segment.updatedBy,
            name: segment.name,
            description: segment.description,
            entityType: segment.type,
            status: segment.status,
            computeType: segment.calculationType,
            scheduleConfig: segment.scheduleConfig as Record<string, unknown> | undefined,
            feature: segment.feature as Record<string, unknown> | undefined,
            conditionGroup: segment.conditionGroup?.conditions?.length ? {...segment.conditionGroup} : undefined,
            rules: [],
            statistics: segment.statistics ? {
                totalMembers: segment.statistics.totalMembers,
                estimatedMembers: segment.statistics.estimatedMembers,
                lastCalculatedAt: segment.statistics.lastCalculatedAt?.toISOString(),
                calculationDuration: segment.statistics.calculationDuration,
                memberGrowth: segment.statistics.memberGrowth,
                calculationVersion: segment.statistics.calculationVersion
            } : undefined,
            memberCount: segment.memberCount,
            lastCalculationTime: segment.lastCalculationTime?.toISOString(),
            nextCalculationTime: segment.nextCalculationTime?.toISOString()
        };
    }

    fromSegmentListToSegmentVOList(segments: Segment[]): SegmentVO[] {
        return segments.map(segment => this.fromSegmentToSegmentVO(segment));
    }

    fromSegmentMemberToSegmentMemberVO(member: SegmentMember): SegmentMemberVO {
        return {
            id: member.id,
            segmentId: member.segmentId,
            memberId: member.memberId,
            joinTime: member.joinedAt.toISOString(),
            joinMethod: member.joinMethod,
            ownedBy: member.ownedBy,
            isDeleted: member.isDeleted,
            createTime: member.createTime?.toISOString() || new Date().toISOString(),
            updateTime: member.updateTime?.toISOString()
        };
    }

    fromSegmentMemberListToSegmentMemberVOList(members: SegmentMember[]): SegmentMemberVO[] {
        return members.map(member => this.fromSegmentMemberToSegmentMemberVO(member));
    }
}
