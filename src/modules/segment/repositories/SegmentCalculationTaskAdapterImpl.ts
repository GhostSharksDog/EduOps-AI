import {SegmentCalculationTask} from '@/modules/segment/domain/entities/SegmentCalculationTask';
import {SegmentCalculationTaskPO} from '@/modules/segment/repositories/persistence/SegmentCalculationTaskPO';
import {SegmentCalculationStatus} from '@/shared/enums/index';
import {SegmentCalculationTaskAdapter} from '@/modules/segment/repositories/SegmentCalculationTaskAdapter';
import {config} from '@/platform/config/index';

export class SegmentCalculationTaskAdapterImpl implements SegmentCalculationTaskAdapter {
    fromPOToSegmentCalculationTask(row: SegmentCalculationTaskPO): SegmentCalculationTask {
        const task = new SegmentCalculationTask(
            row.segmentId,
            row.name || 'Unnamed Task',
            row.ownedBy,
            row.createdBy || '',  // createdBy is 4th parameter
            (row.status as SegmentCalculationStatus) || SegmentCalculationStatus.PENDING,  // status is 5th parameter
            row.description || undefined,
            row.id
        );
        // Set additional properties after construction
        if (row.startTime) {
            task.startTime = row.startTime;
        }
        if (row.endTime) {
            task.endTime = row.endTime;
        }
        if (row.resultCount !== null && row.resultCount !== undefined) {
            task.resultCount = row.resultCount;
        }
        if (row.errorMessage) {
            task.errorMessage = row.errorMessage;
        }
        if (row.isDeleted) {
            task.isDeleted = row.isDeleted;
        }
        if (row.feature) {
            task.feature = row.feature;
        }
        if (row.createTime) {
            task.createTime = row.createTime;
        }
        if (row.updateTime) {
            task.updateTime = row.updateTime;
        }
        return task;
    }

    fromSegmentCalculationTaskToPO(domainTask: SegmentCalculationTask): SegmentCalculationTaskPO {
        return {
            id: domainTask.id,
            segmentId: domainTask.segmentId,
            status: domainTask.status,
            startTime: domainTask.startTime,
            endTime: domainTask.endTime || null,
            resultCount: domainTask.resultCount || 0,
            errorMessage: domainTask.errorMessage || null,
            name: null,
            ownedBy: domainTask.ownedBy ?? config.system.userId,
            description: null,
            isDeleted: false,
            feature: {},
            createTime: new Date(),
            updateTime: new Date(),
            deleteTime: null,
            createdBy: domainTask.createdBy ?? config.system.userId,
            updatedBy: null,
            deletedBy: null
        };
    }
}
