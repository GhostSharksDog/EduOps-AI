/**
 * 业务错误码注册表
 * 
 * 格式: {MODULE}_{CATEGORY}_{ERROR}
 * - MODULE: 业务模块 (TAG, USER, PROFILE, SEGMENT, etc.)
 * - CATEGORY: 错误类别 (VALIDATION, BUSINESS, AUTH, RESOURCE, SYSTEM)
 * - ERROR: 具体错误描述
 */

export const ErrorCodes = {
  // ============ TAG 模块 ============
  // Validation (400)
  TAG_VALIDATION_NAME_EMPTY: { status: 400, message: '标签名称不能为空' },
  TAG_VALIDATION_NAME_TOO_LONG: { status: 400, message: '标签名称超过最大长度' },
  TAG_VALIDATION_RULE_EMPTY: { status: 400, message: '标签规则内容不能为空' },
  TAG_VALIDATION_CATEGORY_NAME_EMPTY: { status: 400, message: '分类名称不能为空' },
  TAG_VALIDATION_SCHEMA_INVALID: { status: 400, message: '目标表schema无效' },

  // Conflict (409)
  TAG_VALIDATION_NAME_DUPLICATE: { status: 409, message: '标签名称已存在' },
  TAG_VERSION_DUPLICATE: { status: 409, message: '标签版本已存在' },
  TAG_CATEGORY_NAME_DUPLICATE: { status: 409, message: '分类名称已存在' },
  TAG_TARGET_TABLE_EXISTS: { status: 409, message: '目标表已存在' },
  TAG_BITMAP_TABLE_ACTIVE_EXISTS: { status: 409, message: '该实体类型已存在活跃的位图表' },

  // Business (422)
  TAG_BUSINESS_RULE_MISSING: { status: 422, message: '标签未配置计算规则' },
  TAG_BUSINESS_RULE_INVALID: { status: 422, message: '标签计算规则无效' },
  TAG_BUSINESS_INVALID_STATUS_TRANSITION: { status: 422, message: '无效的状态转换' },
  TAG_BUSINESS_CANNOT_DELETE_ACTIVE_TABLE: { status: 422, message: '无法删除活跃表' },
  TAG_BUSINESS_TABLE_CREATE_FAILED: { status: 422, message: '创建目标表失败' },
  TAG_TARGET_TABLE_CANNOT_DELETE_LINKED_TAG: { status: 422, message: '无法删除目标表：仍存在关联标签' },
  TAG_BITMAP_TABLE_HAS_USED_BITS: { status: 422, message: '该位图表还有未释放的位，无法停用' },

  // Resource (404)
  TAG_RESOURCE_NOT_FOUND: { status: 404, message: '标签不存在' },
  TAG_CATEGORY_NOT_FOUND: { status: 404, message: '标签分类不存在' },
  TAG_TARGET_TABLE_NOT_FOUND: { status: 404, message: '目标表不存在' },
  TAG_PARENT_CATEGORY_NOT_FOUND: { status: 404, message: '父分类不存在' },

  // ============ USER 模块 ============
  // Auth (401)
  USER_AUTH_UNAUTHORIZED: { status: 401, message: '未授权' },
  USER_AUTH_TOKEN_EXPIRED: { status: 401, message: 'Token已过期' },
  USER_AUTH_TOKEN_INVALID: { status: 401, message: 'Token无效' },

  // Permission (403)
  USER_PERMISSION_DENIED: { status: 403, message: '权限不足' },
  USER_PERMISSION_INSUFFICIENT_ROLE: { status: 403, message: '角色权限不足' },

  // Resource (404)
  USER_RESOURCE_NOT_FOUND: { status: 404, message: '用户不存在' },

  // ============ PROFILE 模块 ============
  PROFILE_RESOURCE_NOT_FOUND: { status: 404, message: '档案不存在' },
  PROFILE_VALIDATION_FIELD_INVALID: { status: 400, message: '档案字段无效' },

  // ============ SEGMENT 模块 ============
  SEGMENT_RESOURCE_NOT_FOUND: { status: 404, message: '人群不存在' },
  SEGMENT_VALIDATION_RULE_INVALID: { status: 400, message: '人群规则无效' },
  SEGMENT_BUSINESS_CALCULATION_FAILED: { status: 422, message: '人群计算失败' },

  // ============ DATA SOURCE 模块 ============
  DATA_SOURCE_RESOURCE_NOT_FOUND: { status: 404, message: '数据源不存在' },
  DATA_SOURCE_CONNECTION_FAILED: { status: 422, message: '连接数据源失败' },
  DATA_SOURCE_VALIDATION_CONFIG_INVALID: { status: 400, message: '数据源配置无效' },

  // ============ DATA MODEL 模块 ============
  DATA_MODEL_RESOURCE_NOT_FOUND: { status: 404, message: '数据模型不存在' },
  DATA_MODEL_VALIDATION_SCHEMA_INVALID: { status: 400, message: '数据模型schema无效' },

  // ============ 通用错误 ============
  VALIDATION_REQUEST_BODY_INVALID: { status: 400, message: '请求体验证失败' },
  VALIDATION_QUERY_PARAMS_INVALID: { status: 400, message: '查询参数验证失败' },
  VALIDATION_PATH_PARAMS_INVALID: { status: 400, message: '路径参数验证失败' },
  
  SYSTEM_INTERNAL_ERROR: { status: 500, message: '服务器内部错误' },
  SYSTEM_DATABASE_ERROR: { status: 500, message: '数据库操作失败' },
  SYSTEM_EXTERNAL_SERVICE_ERROR: { status: 502, message: '外部服务错误' },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * 获取错误码配置
 */
export function getErrorConfig(code: ErrorCode) {
  return ErrorCodes[code];
}

/**
 * 获取错误码的 HTTP 状态
 */
export function getErrorStatus(code: ErrorCode): number {
  return ErrorCodes[code].status;
}

/**
 * 获取错误码的消息
 */
export function getErrorMessage(code: ErrorCode): string {
  return ErrorCodes[code].message;
}
