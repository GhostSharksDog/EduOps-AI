// 分群元数据接口
export interface SegmentMetadata {
    createdAt: Date;
    createdBy: string;
    updatedAt: Date;
    updatedBy: string;
    deletedAt?: Date;
    deletedBy?: string;
    description?: string | null;
    tags?: string[];
    businessOwner?: string;
    technicalOwner?: string;
}
