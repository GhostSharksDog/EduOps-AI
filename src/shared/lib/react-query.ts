import {QueryClient, QueryCache, MutationCache, QueryClientConfig,hashKey} from '@tanstack/react-query';
import {clientIdentityKey} from './client-session';
import axios from 'axios';
import {globalMessage} from '@/shared/lib/message';
import {log} from '@/platform/logger';
import {MESSAGES} from '@/shared/messages/index';

interface ApiError {
    response?: {
        status?: number;
    };
    message?: string;
}

// 处理401错误的统一函数
const handleAuthError = (error: unknown): error is ApiError => {
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || 
            error.message?.includes('未授权') || 
            error.message?.includes('登录已过期')) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
                globalMessage.error(MESSAGES.AUTH.SESSION_EXPIRED);
                setTimeout(() => {
                    window.location.href = '/auth/login';
                }, 1500);
            }
            return true;
        }
    }
    return false;
};

// 创建一个查询客户端
export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error: unknown) => {
            if (handleAuthError(error)) {
                return;
            }
            log.error('Query error', error);
        },
    }),
    mutationCache: new MutationCache({
        onError: (error: unknown) => {
            if (handleAuthError(error)) {
                return;
            }
            log.error('Mutation error', error);
        },
    }),
    defaultOptions: {
        queries: {
            queryKeyHashFn: key => clientIdentityKey()+':'+hashKey(key),
            staleTime: 5 * 60 * 1000,
            retry: (failureCount, error: unknown) => {
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    return false;
                }
                return failureCount < 1;
            },
            refetchOnWindowFocus: false,
        },
    },
} as QueryClientConfig);

if(typeof window!=='undefined')window.addEventListener('education-identity-change',()=>{void queryClient.cancelQueries();queryClient.clear();});
