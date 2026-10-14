import {NextRequest} from 'next/server';
import {Segment, SegmentMember} from '@/modules/segment/domain/entities/index';
import {type SegmentMemberVO, type SegmentVO} from '@/modules/segment/contracts/schemas/response/segment/index';
import {SegmentFilter} from '@/modules/segment/domain/commands/SegmentFilter';
import {SegmentCreateCommand} from '@/modules/segment/contracts/commands/SegmentCreateCommand';
import {SegmentUpdateCommand} from '@/modules/segment/contracts/commands/SegmentUpdateCommand';
import {SegmentDeleteCommand} from '@/modules/segment/domain/commands/SegmentDeleteCommand';

/**
 * 分群模块 OHS (Open Host Service) 适配器接口
 * @description 负责HTTP请求/响应与领域对象之间的转换
 */
export interface SegmentOHSAdapter {
    /**
     * 将HTTP请求转换为列表查询对象
     * @param request HTTP请求对象
     * @returns SegmentFilter
     */
    fromRequestToListSegmentsQuery(request: NextRequest): SegmentFilter;

    /**
     * 将HTTP请求转换为获取单个分群查询
     * @param request HTTP请求对象
     * @param id 分群ID（从路由参数中获取）
     * @returns SegmentFilter
     */
    fromRequestToGetSegmentQuery(request: NextRequest, id?: string): SegmentFilter;

    /**
     * 将HTTP请求转换为创建命令
     * @param request HTTP请求对象
     * @returns Promise<SegmentCreateCommand>
     */
    fromRequestToCreateSegmentCommand(request: NextRequest): Promise<SegmentCreateCommand>;

    /**
     * 将HTTP请求转换为更新命令
     * @param request HTTP请求对象
     * @returns Promise<SegmentUpdateCommand>
     */
    fromRequestToUpdateSegmentCommand(request: NextRequest): Promise<SegmentUpdateCommand>;

    /**
     * 将HTTP请求转换为删除命令
     * @param request HTTP请求对象
     * @returns SegmentDeleteCommand
     */
    fromRequestToDeleteSegmentCommand(request: NextRequest): SegmentDeleteCommand;

    /**
     * 将分群实体转换为响应VO
     * @param segment 分群实体
     */
    fromSegmentToSegmentVO(segment: Segment): SegmentVO;

    /**
     * 批量将分群实体转换为响应VO
     * @param segments 分群实体列表
     */
    fromSegmentListToSegmentVOList(segments: Segment[]): SegmentVO[];

    /**
     * 将分群成员实体转换为响应VO
     * @param member 分群成员实体
     */
    fromSegmentMemberToSegmentMemberVO(member: SegmentMember): SegmentMemberVO;

    /**
     * 批量将分群成员实体转换为响应VO
     * @param members 分群成员实体列表
     */
    fromSegmentMemberListToSegmentMemberVOList(members: SegmentMember[]): SegmentMemberVO[];
}
