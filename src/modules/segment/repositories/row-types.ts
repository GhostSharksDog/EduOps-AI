import type { Feature } from '@/shared/types/feature';
interface AuditRow {
    id: string;
    name: string | null;
    ownedBy: string;
    description: string | null;
    feature: Feature | null;
    isDeleted: boolean;
    createTime: Date;
    updateTime: Date | null;
    deleteTime: Date | null;
    createdBy: string;
    updatedBy: string | null;
    deletedBy: string | null;
}
export interface SegmentRow extends AuditRow {
    entityType: string;
    computeType: string;
    status: string;
    scheduleConfig: Feature | null;
    lastCalculationTime: Date | null;
}
export interface SegmentConditionRow extends AuditRow {
    segmentId: string;
    parentId: string | null;
    conditionType: string;
    operator: string | null;
    fieldName: string | null;
    fieldValue: unknown;
}
export interface SegmentTaskRow extends AuditRow {
    segmentId: string;
    startTime: Date | null;
    endTime: Date | null;
    status: string;
    resultCount: number | null;
    errorMessage: string | null;
}
export interface SegmentMemberRow extends AuditRow {
    segmentId: string;
    memberId: string;
    joinTime: Date | null;
    joinMethod: string;
}
export interface RiskSnapshotRow {
    id: string;
    organizationId: string;
    segmentId: string;
    sourceTagId: string;
    tagVersion: number;
    datasetId: string;
    name: string;
    payload: unknown;
    memberCount: number;
    createdBy: string;
    createdAt: Date;
}
