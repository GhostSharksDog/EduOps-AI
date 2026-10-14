/**
 * 导出格式枚举
 * 用于标签数据导出、用户数据导出等功能
 */
export enum ExportFormat {
  /** CSV格式 - 适用于结构化数据 */
  CSV = 'CSV',
  /** Excel格式 - 适用于复杂报表 */
  EXCEL = 'EXCEL',
  /** JSON格式 - 适用于API和程序化处理 */
  JSON = 'JSON'
}
