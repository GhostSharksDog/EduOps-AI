import {ExportTaskStatus} from '@/shared/enums/tag/ExportTaskStatus';
import {Feature} from "@/shared/types/feature";

/**
 * 标签导出任务实体类
 */
export class TagExportTask {
    constructor(
        public id: string,
        public name: string,
        public ownedBy: string,
        public createdBy: string,
        public description?: string,
        public isDeleted: boolean = false,
        public feature?: Feature,
        public createTime: Date = new Date(),
        public updateTime?: Date,
        public deleteTime?: Date,
        public updatedBy?: string,
        public deletedBy?: string,
        public queryParams?: Feature,
        public status?: ExportTaskStatus,
        public totalCount?: number,
        public exportedCount?: number,
        public filePath?: string,
        public errorMessage?: string
    ) {
    }
}
