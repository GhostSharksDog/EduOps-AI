/**
 * 数据源连接测试结果枚举
 */
export enum TestConnectionResult {
    /** 连接成功 */
    SUCCESS = 'SUCCESS',
    /** 连接失败 */
    FAILED = 'FAILED',
    /** 连接超时 */
    TIMEOUT = 'TIMEOUT',
    /** 不支持的数据库类型 */
    UNSUPPORTED = 'UNSUPPORTED'
}

export const TestConnectionResultLabels: Record<TestConnectionResult, string> = {
    [TestConnectionResult.SUCCESS]: '连接成功',
    [TestConnectionResult.FAILED]: '连接失败',
    [TestConnectionResult.TIMEOUT]: '连接超时',
    [TestConnectionResult.UNSUPPORTED]: '不支持的数据库类型'
};

export const TestConnectionResultOptions = [
    { value: TestConnectionResult.SUCCESS, label: TestConnectionResultLabels[TestConnectionResult.SUCCESS] },
    { value: TestConnectionResult.FAILED, label: TestConnectionResultLabels[TestConnectionResult.FAILED] },
    { value: TestConnectionResult.TIMEOUT, label: TestConnectionResultLabels[TestConnectionResult.TIMEOUT] },
    { value: TestConnectionResult.UNSUPPORTED, label: TestConnectionResultLabels[TestConnectionResult.UNSUPPORTED] }
];
