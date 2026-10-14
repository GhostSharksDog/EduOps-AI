// 分群统计信息接口
export interface SegmentStatistics {
    totalMembers: number;
    estimatedMembers?: number; // 预估成员数
    lastCalculatedAt?: Date | null; // 最后计算时间
    calculationDuration?: number; // 计算时长（毫秒）
    memberGrowth?: number; // 成员增长率
    calculationVersion?: string; // 计算版本号
}
