import {z} from 'zod';

/**
 * 用户响应Schema
 * 用于返回用户的基本信息
 */
export const userResponseSchema = z.strictObject({
    id: z.uuid('用户ID必须是有效的UUID').describe('用户ID'),
    username: z.string('用户名不能为空').trim().describe('用户名'),
    realName: z.string('真实姓名不能为空').trim().describe('真实姓名'),
    email: z.string().trim().email('邮箱格式不正确').or(z.literal('')).optional().describe('邮箱'),
    role: z.string('角色不能为空').trim().describe('角色'),
    ownedBy: z.string().optional().describe('租户ID'),
    companyCode:z.string().optional(),
    companyName:z.string().optional(),
});

/**
 * 用户响应VO类型
 */
export type UserVO = z.infer<typeof userResponseSchema>;
