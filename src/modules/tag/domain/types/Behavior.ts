/**
 * 行为类型
 */
export interface Behavior {
    type: string;
    count: number;
    lastOccurrence: Date;
    averageFrequency: number;
}
