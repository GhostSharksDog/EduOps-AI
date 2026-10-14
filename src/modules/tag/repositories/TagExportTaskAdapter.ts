import {TagExportTask} from '@/modules/tag/domain/entities/TagExportTask';
import {TagExportTaskPO} from '@/modules/tag/repositories/persistence/TagExportTaskPO';

export interface TagExportTaskAdapter {
    fromTagExportTaskPOToTagExportTaskEntity(taskPO: TagExportTaskPO): TagExportTask;

    fromTagExportTaskEntityToTagExportTaskPO(task: TagExportTask): TagExportTaskPO;
}
