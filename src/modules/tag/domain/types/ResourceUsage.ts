/**
 * 资源使用类型
 */
export interface ResourceUsage {
    resourceType: string;
    totalUsage: number;
    peakUsage: number;
    unit: string;
}
