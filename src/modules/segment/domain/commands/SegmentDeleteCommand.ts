/**
 * 分群删除命令
 */
export interface SegmentDeleteCommand {
    /** 分群ID */
    id: string;
    /** 删除人 */
    deletedBy: string;
    /** 租户ID */
    ownedBy?: string;
}
