import {JoinMethod} from '@/shared/enums/index';

/**
 * 添加分群成员命令
 */
export interface AddSegmentMemberCommand {
    /** 分群ID */
    segmentId: string;

    /** 成员ID（用户ID或设备ID） */
    memberId: string;

    /** 加入方式：MANUAL(手动), RULE(规则), CALCULATION(计算) */
    joinMethod?: JoinMethod;

    /** 创建人ID */
    createdBy: string;
    
    /** 租户ID */
    ownedBy?: string;
    
    description?: string,
}
