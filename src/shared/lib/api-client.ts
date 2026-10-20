import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {useAuthStore} from '@/modules/identity/client';
import {globalMessage} from '@/shared/lib/message';
import {log} from '@/platform/logger';
import {MESSAGES} from '@/shared/messages/index';
import {assertClientSession,registerClientRequest} from './client-session';

const sessionRequests=new WeakMap<object,ReturnType<typeof registerClientRequest>>();

export class ApiClient {
    private static axiosInstance: AxiosInstance = axios.create({
        baseURL: '/api',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // 添加请求拦截器和响应拦截器
    static {
        // 请求拦截器：添加认证 token
        this.axiosInstance.interceptors.request.use(
            (config) => {
                // 从 localStorage 获取 token
                if (typeof window !== 'undefined') {
                    const token = useAuthStore.getState().token;
                    if (token) {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                    const request=registerClientRequest(config.signal as AbortSignal|undefined);sessionRequests.set(config,request);config.signal=request.controller.signal;
                }
                return config;
            },
            (error) => {
                log.error('API Client - Request interceptor error', error);
                return Promise.reject(error);
            }
        );

        // 响应拦截器：处理 token 不合法或过期的情况
        this.axiosInstance.interceptors.response.use(
            (response) => {
                const request=sessionRequests.get(response.config);request?.release();if(request)assertClientSession(request.stamp);
                return response;
            },
            async (error) => {
                const request=error.config?sessionRequests.get(error.config):undefined;request?.release();if(request)assertClientSession(request.stamp);
                if (error.response) {
                    const status = error.response.status;

                    // 处理 401 Unauthorized - token 不合法或过期
                    if (status === 401) {
                        const logout = useAuthStore.getState().logout;
                        await logout();
                        globalMessage.error(MESSAGES.AUTH.SESSION_EXPIRED);
                    }
                    // 处理 403 Forbidden - 没有权限访问
                    else if (status === 403) {
                        globalMessage.error(MESSAGES.API.FORBIDDEN);
                    }
                    // 处理 404 Not Found - 资源不存在
                    else if (status === 404) {
                        globalMessage.error(MESSAGES.API.NOT_FOUND);
                    }
                    // 处理 500 Internal Server Error - 服务器错误
                    else if (status === 500) {
                        globalMessage.error(MESSAGES.API.SERVER_ERROR);
                    }
                    // 处理其他常见客户端错误 (400-499)
                    else if (status >= 400 && status < 500) {
                        const data = error.response.data;
                        const errorCode = data?.code;
                        const errorMessage = data?.error || data?.message || MESSAGES.API.REQUEST_FAILED;
                        globalMessage.error(errorCode ? `${errorMessage} (${errorCode})` : errorMessage);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    static async get<Res>(
        endpoint: string,
        params?: Record<string, unknown>
    ): Promise<Res> {
        // 过滤掉undefined值的参数
        const filteredParams = params ? Object.fromEntries(
            Object.entries(params).filter(([, value]) => value !== undefined)
        ) : undefined;

        return this.request<never, Res>(endpoint, {
            method: 'GET',
            params: filteredParams,
        });
    }

    static async post<Req, Res = unknown>(
        endpoint: string,
        data: Req
    ): Promise<Res> {
        return this.request<Req, Res>(endpoint, {
            method: 'POST',
            data,
        });
    }

    static async put<Req, Res = unknown>(
        endpoint: string,
        data: Req
    ): Promise<Res> {
        return this.request<Req, Res>(endpoint, {
            method: 'PUT',
            data,
        });
    }

    static async delete<Req = never, Res = unknown>(
        endpoint: string,
        data?: Req
    ): Promise<Res> {
        return this.request<Req, Res>(endpoint, {
            method: 'DELETE',
            data,
        });
    }

    static async patch<Req, Res = unknown>(
        endpoint: string,
        data: Req
    ): Promise<Res> {
        return this.request<Req, Res>(endpoint, {
            method: 'PATCH',
            data,
        });
    }

    private static async request<Req, Res>(
        endpoint: string,
        config?: AxiosRequestConfig & { data?: Req }
    ): Promise<Res> {
        try {
            const response = await this.axiosInstance.request<Res>({
                url: endpoint,
                ...config,
            });
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response) {
                const responseData = error.response.data;
                const errorMessage = responseData?.error || responseData?.message || MESSAGES.API.REQUEST_FAILED;
                throw new Error(errorMessage);
            }
            throw error;
        }
    }
}
