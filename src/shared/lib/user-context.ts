import {NextRequest} from 'next/server';
import {UserDTO} from '@/shared/schemas/index';
import {log} from '@/platform/logger';

/**
 * 用户上下文管理类
 * 用于在请求生命周期中存储和获取用户信息
 */
export class UserContext {
    /**
     * 上下文存储的头部键名
     */
    private static readonly CONTEXT_KEY = 'x-user-context';

    /**
     * 将用户信息存储到请求上下文中
     * @param request NextRequest对象
     * @param user 用户信息对象
     */
    static set(request: NextRequest, user: UserDTO): void {
        try {
            // 将用户信息序列化为JSON字符串并存储到请求头中
            request.headers.set(this.CONTEXT_KEY, JSON.stringify(user));
        } catch (error) {
            log.error('UserContext.set - Error storing user context:', error);
        }
    }

    /**
     * 从请求上下文中获取用户信息
     * @param request NextRequest对象
     * @returns 用户信息对象，如果不存在则返回null
     */
    static get(request: NextRequest): UserDTO | null {
        try {
            const context = request.headers.get(this.CONTEXT_KEY);
            if (!context) {
                return null;
            }
            return JSON.parse(context) as UserDTO;
        } catch (error) {
            log.error('UserContext.get - Error retrieving user context:', error);
            return null;
        }
    }

    /**
     * 从请求上下文中获取用户ID
     * @param request NextRequest对象
     * @returns 用户ID，如果不存在则返回null
     */
    static getUserId(request: NextRequest): string | null {
        const user = this.get(request);
        return user?.id || null;
    }

    /**
     * 从请求上下文中获取用户名
     * @param request NextRequest对象
     * @returns 用户名，如果不存在则返回null
     */
    static getUsername(request: NextRequest): string | null {
        const user = this.get(request);
        return user?.username || null;
    }

    /**
     * 从请求上下文中获取用户角色
     * @param request NextRequest对象
     * @returns 用户角色，如果不存在则返回null
     */
    static getRole(request: NextRequest): string | null {
        const user = this.get(request);
        return user?.role || null;
    }

    /**
     * 检查请求上下文中是否存在用户信息
     * @param request NextRequest对象
     * @returns 存在用户信息返回true，否则返回false
     */
    static hasUser(request: NextRequest): boolean {
        return this.get(request) !== null;
    }
}