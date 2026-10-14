import {TagExportTaskAdapter} from '@/modules/tag/repositories/TagExportTaskAdapter';
import {TagExportTask} from '@/modules/tag/domain/entities/TagExportTask';
import {TagExportTaskPO} from '@/modules/tag/repositories/persistence/TagExportTaskPO';
import {ExportTaskStatus} from '@/shared/enums/tag/ExportTaskStatus';

export class TagExportTaskAdapterImpl implements TagExportTaskAdapter {
    fromTagExportTaskPOToTagExportTaskEntity(taskPO: TagExportTaskPO): TagExportTask {
        const feature = typeof taskPO.feature === 'object' && taskPO.feature !== null && !Array.isArray(taskPO.feature) ? taskPO.feature : {};

        return new TagExportTask(
            taskPO.id,
            taskPO.name || 'Export Task',
            taskPO.ownedBy,
            taskPO.createdBy ?? '',
            taskPO.description || undefined,
            taskPO.isDeleted || false,
            feature,
            taskPO.createTime || new Date(),
            taskPO.updateTime || undefined,
            taskPO.deleteTime || undefined,
            taskPO.updatedBy || undefined,
            taskPO.deletedBy || undefined,
            typeof taskPO.queryParams === 'object' && taskPO.queryParams !== null && !Array.isArray(taskPO.queryParams) ? taskPO.queryParams : undefined,
            taskPO.status as ExportTaskStatus,
            taskPO.totalCount || 0,
            taskPO.exportedCount || 0,
            taskPO.filePath || undefined,
            taskPO.errorMessage || undefined
        );
    }

    fromTagExportTaskEntityToTagExportTaskPO(task: TagExportTask): TagExportTaskPO {
        const po: TagExportTaskPO = {
            id: task.id,
            name: task.name || null,
            description: task.description || null,
            ownedBy: task.ownedBy,
            isDeleted: task.isDeleted || false,
            feature: task.feature || {},
            createTime: task.createTime || new Date(),
            updateTime: task.updateTime || new Date(),
            deleteTime: task.deleteTime || null,
            createdBy: task.createdBy ?? null,
            updatedBy: task.updatedBy || null,
            deletedBy: task.deletedBy || null,
            queryParams: task.queryParams || null,
            status: task.status as string,
            totalCount: task.totalCount || 0,
            exportedCount: task.exportedCount || 0,
            filePath: task.filePath || null,
            errorMessage: task.errorMessage || null
        };

        return po;
    }
}
