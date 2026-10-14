import {z} from 'zod';

/**
 * 用户信息Schema
 * 本地账号的身份信息
 */
export const userSchema = z.strictObject({
    id: z.string().trim().min(1, '用户ID不能为空').describe('用户ID'),
    username: z.string().trim().min(1, '用户名不能为空').describe('用户名'),
    role: z.string().trim().min(1, '用户角色不能为空').describe('用户角色'),
    realName: z.string().trim().min(1, '用户姓名不能为空').describe('用户姓名'),
    email: z.email('邮箱格式不正确').optional().describe('用户邮箱'),
    ownedBy: z.string().optional().describe('租户ID'),
});

/**
 * 用户信息DTO类型
 */
export type UserDTO = z.infer<typeof userSchema>;
