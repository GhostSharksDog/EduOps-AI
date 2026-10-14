/**
 * Centralized message constants for frontend notifications
 * 
 * Usage:
 *   import { useGlobalMessage } from '@/shared/lib/message-service';
 *   import { MESSAGES } from '@/shared/messages/index';
 *   
 *   const { success, error } = useGlobalMessage();
 *   success(MESSAGES.COMMON.SAVE_SUCCESS);
 */

export const MESSAGES = {
  COMMON: {
    SAVE_SUCCESS: '保存成功',
    DELETE_SUCCESS: '删除成功',
    RESTORE_SUCCESS: '恢复成功',
    COPY_SUCCESS: '复制成功',
    OPERATION_SUCCESS: '操作成功',
    PERMANENT_DELETE_SUCCESS: '永久删除成功',
    SAVE_FAILED: '保存失败',
    DELETE_FAILED: '删除失败',
    RESTORE_FAILED: '恢复失败',
    COPY_FAILED: '复制失败',
    OPERATION_FAILED: '操作失败',
    DELETE_CONFIRM_TITLE: '确认删除',
    DELETE_CONFIRM_CONTENT: '确定要删除吗？此操作无法撤销',
    PERMANENT_DELETE_CONFIRM_TITLE: '永久删除',
    PERMANENT_DELETE_CONFIRM_CONTENT: '确定要永久删除吗？此操作无法撤销',
    OK: '确定',
    CANCEL: '取消',
    CONFIRM: '确认',
    CLOSE: '关闭',
    SAVE: '保存',
    CREATE: '创建',
    RESET: '重置',
    CONFIRM_RESTORE: '确认恢复',
    CONFIRM_PERMANENT_DELETE: '确认永久删除',
    UNKNOWN_ERROR: '未知错误',
  },

  DATA_SOURCE: {
    CONNECTION_SUCCESS: '连接成功',
    CONNECTION_FAILED: '连接失败',
    TEST_SUCCESS: '测试连接成功',
    TEST_FAILED: '测试连接失败',
    CREATE_SUCCESS: '数据源创建成功',
    UPDATE_SUCCESS: '数据源更新成功',
    DELETE_SUCCESS: '数据源删除成功',
    STATUS_UPDATE_SUCCESS: '更新数据源状态成功',
    SYNC_SUCCESS: '同步成功',
    SYNC_FAILED: '同步失败',
    DELETE_CONFIRM_CONTENT: '删除后数据源将被软删除，无法恢复',
    STATUS_ENABLE_CONFIRM_TITLE: '确定要启用该数据源吗？',
    STATUS_DISABLE_CONFIRM_TITLE: '确定要禁用该数据源吗？',
    STATUS_CONFIRM_CONTENT: '此操作将影响该数据源的使用状态',
    // 错误
    CREATE_FAILED: '创建数据源失败',
    UPDATE_FAILED: '更新数据源失败',
    DELETE_FAILED: '删除数据源失败',
    STATUS_UPDATE_FAILED: '更新数据源状态失败',
  },

  DB_BROWSER: {
    LOAD_TABLES_FAILED: '加载表列表失败',
    LOAD_PREVIEW_FAILED: '加载数据预览失败',
    TRUNCATE_SUCCESS: '表已清空',
    TRUNCATE_FAILED: '清空表失败',
    TRUNCATE_CONFIRM_TITLE: '确认清空',
    TRUNCATE_CONFIRM_CONTENT: '确定要清空该表吗？此操作不可恢复！',
  },

  TAGS: {
    BIT_RELEASE_SUCCESS: '位释放成功',
    BIT_RELEASE_FAILED: '释放失败，请重试',
    NO_BITS_TO_RELEASE: '没有需要释放的位',
    VERSION_CREATE_SUCCESS: '版本创建成功',
    VERSION_SWITCH_SUCCESS: '版本切换成功',
    DELETE_CONFIRM_CONTENT: '确定要删除这个标签吗？此操作无法撤销',
    ACTIVATE_CONFIRM_TITLE: '激活标签',
    ACTIVATE_CONFIRM_CONTENT: '确定要激活该标签吗？激活后标签将生效',
    DEACTIVATE_CONFIRM_TITLE: '停用标签',
    DEACTIVATE_CONFIRM_CONTENT: '确定要停用该标签吗？停用后标签将不再生效',
    RESUME_CONFIRM_TITLE: '恢复标签',
    RESUME_CONFIRM_CONTENT: '确定要恢复该标签吗？恢复后标签将重新生效',
    // 位图表相关
    TABLE_ACTIVATE_CONFIRM_TITLE: '确认激活此表？',
    TABLE_ACTIVATE_CONFIRM_CONTENT: '激活后，该表将可以继续分配位',
    TABLE_DEACTIVATE_CONFIRM_TITLE: '确认停用此表？',
    TABLE_DEACTIVATE_CONFIRM_CONTENT: '停用后，该表将不再分配新位',
    // 位释放确认
    BIT_RELEASE_CONFIRM_TITLE: '确认释放此位？',
    BIT_RELEASE_UNASSIGNED_TITLE: '释放未使用的位',
    // 查询
    QUERY_FAILED: '查询失败',
  },

  VALIDATION: {
    INVALID_UUID_FORMAT: '无效的实体 ID 格式，请输入有效的 UUID 格式',
    INVALID_UUID_FORMAT_DETAIL: '无效的实体 ID 格式',
    UUID_FORMAT_HINT: '请输入有效的 UUID 格式',
    REQUIRED_FIELD: '此字段为必填项',
    INVALID_FORMAT: '格式无效',
  },

  SETTINGS: {
    APPEARANCE_SAVED: '外观设置已保存',
    SECURITY_SAVED: '安全设置已保存',
    SAVE_FAILED: '保存设置失败',
  },

  RECYCLE_BIN: {
    RESTORE_SUCCESS: '恢复成功',
    PERMANENT_DELETE_SUCCESS: '永久删除成功',
    BATCH_RESTORE_SUCCESS: '批量恢复成功',
    BATCH_DELETE_SUCCESS: '批量永久删除成功',
    BATCH_PERMANENT_DELETE_TITLE: '批量永久删除',
    BATCH_PERMANENT_DELETE_CONFIRM: '确定要永久删除选中的项吗？',
    OPERATION_FAILED: '操作失败',
    RESTORE_CONFIRM_TITLE: '确认恢复',
    RESTORE_CONFIRM_CONTENT: '确定要恢复"{name}"吗？恢复后数据将重新可用。',
    PERMANENT_DELETE_CONFIRM_TITLE: '永久删除',
    PERMANENT_DELETE_CONFIRM_CONTENT: '确定要永久删除"{name}"吗？',
    PERMANENT_DELETE_WARNING: '此操作不可撤销，数据将无法恢复',
    BATCH_RESTORE_CONFIRM_TITLE: '批量恢复',
    BATCH_RESTORE_CONFIRM_CONTENT: '确定要批量恢复选中的 {count} 项数据吗？恢复后数据将重新可用。',
  },

  TAG_CATEGORY: {
    CREATE_SUCCESS: '分类创建成功',
    UPDATE_SUCCESS: '分类更新成功',
    DELETE_SUCCESS: '分类已删除',
    DELETE_FAILED: '分类删除失败',
    BATCH_DELETE_SUCCESS: '批量删除成功',
    BATCH_DELETE_FAILED: '批量删除失败',
    OPERATION_FAILED: '操作失败',
    DELETE_CONFIRM_TITLE: '确认删除',
    DELETE_CONFIRM_CONTENT: '确定要删除这个分类吗？',
    BATCH_DELETE_CONFIRM_TITLE: '批量删除分类',
    BATCH_DELETE_CONFIRM_CONTENT: '确定要删除选中的 {count} 个分类吗？',
  },

  TAG_VERSION: {
    CREATE_SUCCESS: '标签版本创建成功',
    SWITCH_SUCCESS: '版本切换成功',
    UPDATE_SUCCESS: '当前版本已更新',
    CREATE_FAILED: '标签版本创建失败',
    SET_CURRENT_FAILED: '设置当前版本失败',
    SET_CURRENT_CONFIRM_TITLE: '确认设置为当前版本',
    SET_CURRENT_CONFIRM_CONTENT: '确定要将此版本设置为当前生效版本吗？',
  },

  SQL: {
    PARSE_SUCCESS: 'SQL解析成功',
    PARSE_FAILED: 'SQL解析失败，请检查语句是否正确',
    SYNTAX_ERROR: 'SQL语法错误',
    INPUT_REQUIRED: '请输入CREATE TABLE语句',
  },

  SEGMENT: {
    DELETE_CONFIRM_TITLE: '确认删除分群?',
    DELETE_CONFIRM_CONTENT: '删除后将无法恢复，且基于该分群的服务将失效',
  },

  AUTH: {
    LOGIN_SUCCESS: '登录成功',
    LOGOUT_SUCCESS: '已退出登录',
    SESSION_EXPIRED: '登录已过期，请重新登录',
    LOGIN_FAILED: '登录失败',
    LOGOUT_FAILED: '退出登录失败',
  },

  API: {
    FORBIDDEN: '您没有权限访问此资源',
    NOT_FOUND: '请求的资源不存在',
    SERVER_ERROR: '服务器错误，请稍后重试',
    NETWORK_ERROR: '网络错误，请检查网络连接',
    REQUEST_FAILED: '请求失败',
  },

  DATA_IMPORT: {
    TEMPLATE_DOWNLOAD_SUCCESS: '模板下载成功',
    TEMPLATE_DOWNLOAD_FAILED: '模板下载失败',
    FILE_REQUIRED: '请先上传文件',
    DATA_TYPE_REQUIRED: '请选择数据类型',
    IMPORT_COMPLETE: '数据导入完成',
    IMPORT_FAILED: '数据导入失败',
    EXCEL_ONLY: '只能上传 Excel 文件',
    FILE_SIZE_LIMIT: '文件大小不能超过 10MB',
    IMPORT_DETAILS_TITLE: '导入详情',
  },

  DATA_MODEL: {
    NAME_REQUIRED: '模型名称不能为空',
    NAME_EXISTS: '模型名称已存在',
    DATASOURCE_NOT_FOUND: '数据源不存在',
    MODEL_NOT_FOUND: '模型不存在',
    MODEL_IN_USE: '模型已被引用，无法删除',
    COLUMN_NAME_EXISTS: '列名称在模型内已存在',
    INVALID_DATA_TYPE: '数据类型无效',
    INVALID_PRIMARY_KEY: '主键设置不正确',
    DB_OPERATION_FAILED: '数据库操作失败',
    CREATE_SUCCESS: '模型创建成功',
    UPDATE_SUCCESS: '模型更新成功',
    DELETE_SUCCESS: '模型删除成功',
    ACTIVATE_SUCCESS: '模型已激活',
    DEACTIVATE_SUCCESS: '模型已停用',
    NAME_MAX_LENGTH: '模型名称长度不能超过255个字符',
    TABLE_NAME_MAX_LENGTH: '表名长度不能超过255个字符',
    COLUMN_NAME_REQUIRED: '请输入列名',
    DATA_TYPE_REQUIRED: '请选择数据类型',
    ACTIVATE_CONFIRM_TITLE: '确定要激活该数据模型吗？',
    DEACTIVATE_CONFIRM_TITLE: '确定要停用该数据模型吗？',
    DELETE_CONFIRM_TITLE: '确定要删除该数据模型吗？',
    STATUS_CONFIRM_CONTENT: '此操作将影响该数据模型的使用状态。',
    DELETE_CONFIRM_CONTENT: '删除后数据模型将无法恢复，请谨慎操作。',
    CLEAR_COLUMNS_TITLE: '清除所有列',
    CLEAR_COLUMNS_CONTENT: '确定要清除所有列定义吗？此操作不可恢复。',
  },

  FORM_VALIDATION: {
    // 通用
    REQUIRED: '此字段为必填项',
    PLEASE_INPUT: '请输入',
    PLEASE_SELECT: '请选择',
    // 格式验证
    INVALID_UUID: '请输入有效的UUID格式',
    INVALID_CODE_FORMAT: '编码只能包含大写字母、数字和下划线，且必须以字母或下划线开头',
    // 长度验证
    MAX_LENGTH_255: '长度不能超过255个字符',
    LENGTH_RANGE_1_255: '名称长度必须在1-255个字符之间',
    DESCRIPTION_MAX_500: '描述不能超过500个字符',
    CATEGORY_NAME_LENGTH: '分类名称长度应在 2-50 个字符之间',
    // 具体字段
    DATASOURCE_NAME_REQUIRED: '请输入数据源名称',
    DATASOURCE_TYPE_REQUIRED: '请选择数据源类型',
    HOST_REQUIRED: '请输入主机地址',
    PORT_REQUIRED: '请输入端口',
    DATABASE_REQUIRED: '请输入数据库名称',
    USERNAME_REQUIRED: '请输入用户名',
    PASSWORD_REQUIRED: '请输入密码',
    STATUS_REQUIRED: '请选择状态',
    TAG_NAME_REQUIRED: '请输入标签名称',
    CATEGORY_REQUIRED: '请选择所属分类',
    VERSION_REQUIRED: '请输入版本号',
    VERSION_NAME_REQUIRED: '请输入版本名称',
    RULE_TYPE_REQUIRED: '请选择规则类型',
    DATA_MODEL_REQUIRED: '请选择数据模型',
    RULE_CONTENT_REQUIRED: '请输入规则内容',
    SEGMENT_NAME_REQUIRED: '请输入分群名称',
    SEGMENT_RULES_REQUIRED: '请配置至少一个规则',
    CATEGORY_NAME_REQUIRED: '请输入分类名称',
    // 选择验证
    SELECT_AT_LEAST_ONE: '请至少选择一个',
    SELECT_AT_LEAST_TWO: '请选择至少2个',
  },

  API_RESPONSE: {
    // 通用操作
    BATCH_DELETE_SUCCESS: '批量删除成功',
    RESTORE_SUCCESS: '恢复成功',
    // 数据源
    DATASOURCE_DELETE_SUCCESS: '数据源删除成功',
    // 数据模型
    DATAMODEL_DELETE_SUCCESS: '模型删除成功',
    // 标签
    TAG_DELETE_SUCCESS: '标签删除成功',
    TAG_RESUMED: '标签已恢复',
   TAG_DEACTIVATED: '标签已停用',
  TAG_DEPRECATED: '标签已废弃',
  TAG_RESTORED: '标签已恢复',
    CATEGORY_DELETE_SUCCESS: '分类删除成功',
    // 认证
    LOGOUT_SUCCESS: '登出成功',
    // 监控
    ERROR_RESOLVED: '错误已标记为已解决',
  },
} as const;

export type MessageKey = typeof MESSAGES;
