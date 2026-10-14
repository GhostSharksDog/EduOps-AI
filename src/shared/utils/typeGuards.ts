import type {JsonValue,JsonObject,JsonArray} from '@/shared/types/jsonValue';

/**
 * 判断值是否为 JSON 对象类型
 * @param value 待判断的值
 * @returns 是否为 JSON 对象
 */
export function isJsonObject(value: JsonValue): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 判断值是否为 JSON 数组类型
 * @param value 待判断的值
 * @returns 是否为 JSON 数组
 */
export function isJsonArray(value: JsonValue): value is JsonArray {
    return Array.isArray(value);
}

/**
 * 判断值是否为 JSON 基本类型（字符串、数字、布尔值）
 * @param value 待判断的值
 * @returns 是否为 JSON 基本类型
 */
export function isJsonPrimitive(value: JsonValue): value is string | number | boolean {
    const type = typeof value;
    return type === 'string' || type === 'number' || type === 'boolean';
}

/**
 * UUID v4 正则表达式
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 判断值是否为有效的 UUID
 * @param value 待判断的值
 * @returns 是否为有效的 UUID 字符串
 */
export function isValidUUID(value: string | null | undefined): value is string {
    return !!value && UUID_REGEX.test(value);
}
