/**
 * 统一错误信息映射
 * 用于管理所有Schema验证的错误信息
 */
export const errorMessages = {
    // 通用错误
    required: '该字段不能为空',
    minLength: (min: number) => `最少需要${min}个字符`,
    maxLength: (max: number) => `最多允许${max}个字符`,
    minValue: (min: number) => `最小值为${min}`,
    maxValue: (max: number) => `最大值为${max}`,
    invalidType: (expected: string) => `类型错误，期望${expected}`,
    invalidUUID: '必须是有效的UUID格式',
    invalidEmail: '邮箱格式不正确',
    invalidURL: 'URL格式不正确',
    invalidDate: '日期格式不正确',
    invalidDateTime: '日期时间格式不正确',

    // 特定业务错误
    invalidEnum: (enumValues: string[]) => `必须是以下值之一: ${enumValues.join(', ')}`,
    invalidSortOrder: '排序方向必须是ASC或DESC',
    invalidExportFormat: '导出格式必须是CSV、EXCEL或JSON',
    invalidEncoding: '编码格式必须是UTF-8或GBK',
    invalidGranularity: '时间粒度必须是DAY、WEEK或MONTH',
    invalidRefreshType: '刷新类型必须是FULL或INCREMENTAL',
    invalidStatus: '状态值无效',
    invalidRuleType: '规则类型无效',

    // 业务逻辑错误
    endTimeBeforeStart: '结束时间必须晚于开始时间',
    duplicateName: '名称已存在',
    notFound: '资源不存在',
    permissionDenied: '权限不足',
    operationFailed: '操作失败'
};

/**
 * 获取错误信息
 * @param key 错误键名
 * @param params 错误参数
 * @returns 格式化后的错误信息
 */
export const getErrorMessage = (key: keyof typeof errorMessages, ...params: unknown[]): string => {
    const message = errorMessages[key];
    if (typeof message === 'function') {
        return (message as (...args: unknown[]) => string)(...params);
    }
    return message;
};