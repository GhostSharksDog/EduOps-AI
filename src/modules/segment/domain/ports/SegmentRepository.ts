import {Segment} from '@/modules/segment/domain/entities/Segment';
import {SegmentStatus} from '@/shared/enums/index';
import {SegmentFilter} from '@/modules/segment/domain/commands/SegmentFilter';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 分页结果
 */
export interface Page<T> {
    /**
     * 分页数据
     */
    items: T[];
    /**
     * 总数量
     */
    total: number;
    /**
     * 当前页码
     */
    page: number;
    /**
     * 每页数量
     */
    pageSize: number;
}

/**
 * 分群仓库接口
 */
export interface SegmentRepository {
    /**
     * 保存分群
     * @param segment 分群实体
     */
    save(segment: Segment): Promise<void>;

    /**
     * 删除分群
     * @param segmentId 分群ID
     * @param tenantFilter 租户过滤选项
     */
    remove(segmentId: string, tenantFilter?: TenantFilterOptions): Promise<void>;

    /**
     * 根据ID获取分群
     * @param segmentId 分群ID
     * @returns 分群实体，找不到则返回null
     */
    findById(segmentId: string, tenantFilter?: TenantFilterOptions): Promise<Segment | null>;

    /**
     * 根据名称获取分群
     * @param name 分群名称
     * @returns 分群实体，找不到则返回null
     */
    findByName(name: string, tenantFilter?: TenantFilterOptions): Promise<Segment | null>;

    /**
     * 根据状态获取分群列表
     * @param status 分群状态
     * @returns 分群列表
     */
    findByStatus(status: SegmentStatus): Promise<Segment[]>;

    /**
     * 获取所有分群
     * @param filter 查询过滤条件
     * @returns 分页后的分群列表
     */
    findAll(filter: SegmentFilter): Promise<Page<Segment>>;
}