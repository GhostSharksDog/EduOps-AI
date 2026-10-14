/**
 * 分群类型枚举 - 对应 segment.entity_type
 */
export enum SegmentType {
    /** 教培学员分群 */
    STUDENT = 'STUDENT',
    /** 用户分群 */
    USER = 'USER',
    /** 设备分群 */
    DEVICE = 'DEVICE',
    /** 自定义分群 */
    CUSTOM = 'CUSTOM',
    /** 动态分群 */
    DYNAMIC = 'DYNAMIC',
    /** 静态分群 */
    STATIC = 'STATIC'
}
