/**
 * 标签值类型枚举
 */
export enum TagValueType {
    /** 字符串类型 */
    STRING = 'STRING',
    /** 数值类型 */
    NUMBER = 'NUMBER',
    /** 布尔类型 */
    BOOLEAN = 'BOOLEAN',
    /** 日期类型 */
    DATE = 'DATE',
    /** 日期时间类型 */
    DATETIME = 'DATETIME',
    /** 枚举类型（多个离散值，如 低/中/高） */
    ENUM = 'ENUM'
}
