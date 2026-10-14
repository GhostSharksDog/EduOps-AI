/**
 * 回收站项目类型枚举
 */
export enum RecycleBinItemType {
    /** 标签 */
    TAG = 'TAG',
    /** 标签分类 */
    TAG_CATEGORY = 'TAG_CATEGORY',
    /** 分群 */
    SEGMENT = 'SEGMENT',
    /** 数据源 */
    DATA_SOURCE = 'DATA_SOURCE',
    /** 数据模型 */
    DATA_MODEL = 'DATA_MODEL',
    /** 目标表 */
    TARGET_TABLE = 'TARGET_TABLE',
    /** 模型列 */
    MODEL_COLUMN = 'MODEL_COLUMN',
    BITMAP_TABLE = 'BITMAP_TABLE'
}
