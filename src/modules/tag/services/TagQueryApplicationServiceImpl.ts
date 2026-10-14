import { config } from '@/platform/config/index';
import {TagQueryApplicationService} from '@/modules/tag/services/index';
import {
    CountTagsQuery,
    ExportTagsQuery,
    GetTagsByCategoryQuery,
    GetTagsByStatusQuery,
    GetTagsByTypeQuery,
    SearchTagsQuery
} from '@/modules/tag/contracts/queries/index';
import {PagedVO} from '@/shared/schemas/common/index';
import {TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {ExportTaskVO} from '@/modules/tag/contracts/schemas/response/export-task/index';
import {ExportTaskStatus, ExportFormat, ScheduleType, SortOrder, EncodingType} from '@/shared/enums/index';
import {TagQueryDomainService} from '@/modules/tag/domain/services/ports/TagQueryDomainService';
import {Tag} from '@/modules/tag/domain/entities/Tag';
import {ITagOHSAdapter} from '@/modules/tag/services/ITagOHSAdapter';

export class TagQueryApplicationServiceImpl implements TagQueryApplicationService {
    constructor(
        private readonly tagQueryDomainService: TagQueryDomainService,
        private readonly tagOHSAdapter: ITagOHSAdapter
    ) {
    }

    async searchTags(query: SearchTagsQuery): Promise<PagedVO<TagVO>> {
        const tags = await this.tagQueryDomainService.searchTags(query, {
            page: query.page || 1,
            pageSize: query.pageSize || 10,
            sortOrder: SortOrder.ASC
        });

        const totalCount = await this.tagQueryDomainService.countTagsByCriteria({
            categoryId: query.categoryId,
            type: query.type,
            valueType: query.valueType,
            status: query.status
        });

        return this.createPagedResponse(tags, totalCount, query.page, query.pageSize);
    }

    async getTagsByCategory(query: GetTagsByCategoryQuery): Promise<PagedVO<TagVO>> {
        const tags = await this.tagQueryDomainService.getTagsByCategory(query.categoryId, {
            page: query.page || 1,
            pageSize: query.pageSize || 10,
            sortOrder: SortOrder.DESC
        });

        const totalCount = await this.tagQueryDomainService.countTagsByCriteria({
            categoryId: query.categoryId
        });

        return this.createPagedResponse(tags, totalCount, query.page, query.pageSize);
    }

    async getTagsByType(query: GetTagsByTypeQuery): Promise<PagedVO<TagVO>> {
        const tags = await this.tagQueryDomainService.searchTags({
            type: query.type
        }, {
            page: query.page || 1,
            pageSize: query.pageSize || 10,
            sortOrder: SortOrder.DESC
        });

        const totalCount = await this.tagQueryDomainService.countTagsByCriteria({
            type: query.type
        });

        return this.createPagedResponse(tags, totalCount, query.page, query.pageSize);
    }

    async getTagsByStatus(query: GetTagsByStatusQuery): Promise<PagedVO<TagVO>> {
        const tags = await this.tagQueryDomainService.getTagsByStatus(query.status, {
            page: query.page || 1,
            pageSize: query.pageSize || 10,
            sortOrder: SortOrder.DESC
        });

        const totalCount = await this.tagQueryDomainService.countTagsByCriteria({
            status: query.status
        });

        return this.createPagedResponse(tags, totalCount, query.page, query.pageSize);
    }

    async countTags(query: CountTagsQuery): Promise<number> {
        return this.tagQueryDomainService.countTagsByCriteria(query);
    }

    async exportTags(query: ExportTagsQuery): Promise<ExportTaskVO> {
        const format = Object.values(ExportFormat).includes(query.format as ExportFormat)
            ? query.format as ExportFormat
            : ExportFormat.CSV;
        return {
            id: 'task-' + Date.now(),
            ownedBy: config.system.userId,
            isDeleted: false,
            createTime: new Date().toISOString(),
            name: '导出标签任务',
            exportType: format,
            dataSourceId: '00000000-0000-0000-0000-000000000000',
            dataModelId: '00000000-0000-0000-0000-000000000000',
            fields: [],
            fileConfig: {
                fileName: 'tags-export.csv',
                includeHeader: true,
                encoding: EncodingType.UTF8
            },
            scheduleConfig: {
                scheduleType: ScheduleType.IMMEDIATE
            },
            status: ExportTaskStatus.PENDING
        };
    }

    private createPagedResponse(tags: Tag[], totalCount: number, page?: number, pageSize?: number): PagedVO<TagVO> {
        const p = page || 1;
        const ps = pageSize || 10;
        return {
            items: tags.map(tag => this.tagOHSAdapter.fromTagToTagVO(tag)),
            totalCount: totalCount,
            page: p,
            pageSize: ps,
            totalPages: Math.ceil(totalCount / ps)
        };
    }
}
