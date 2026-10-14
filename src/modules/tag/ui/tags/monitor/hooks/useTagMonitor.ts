'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';

export type MvStatus = 'healthy' | 'warning' | 'error';

export interface MvStatusReport {
  tagId: string;
  tagName: string;
  mvName: string;
  status: MvStatus;
  statusDescription: string;
  lastRefreshTime: string | null;
  lastException: string | null;
  isStale: boolean;
}

export interface ErrorLog {
    id: string;
    tagId: string;
    tagName: string;
    mvName: string;
    errorMessage: string;
    occurredAt: string;
    isSevere: boolean;
    isResolved: boolean;
}

export interface TagMonitorQuery {
    status?: MvStatus | 'all';
    search?: string;
    tagId?: string;
}

export const useTagMonitorStatus = (query: TagMonitorQuery = {}) => {
    const params = new URLSearchParams();
    if (query.status && query.status !== 'all') {
        params.set('status', query.status);
    }
    if (query.search) {
        params.set('search', query.search);
    }
    if (query.tagId) {
        params.set('tagId', query.tagId);
    }
    const queryString = params.toString();
    const url = `/tags/monitor${queryString ? `?${queryString}` : ''}`;

    return useQuery<MvStatusReport[]>({
        queryKey: ['tag-monitor-status', query],
        queryFn: async () => {
            return await ApiClient.get<MvStatusReport[]>(url);
        },
        staleTime: 30000,
        refetchInterval: 60000,
        refetchIntervalInBackground: false,
    });
};

export const useTagMonitorErrorLogs = (unresolvedOnly: boolean = true) => {
    return useQuery<ErrorLog[]>({
        queryKey: ['tag-monitor-error-logs', unresolvedOnly],
        queryFn: async () => {
            // Convert boolean to string for URL query parameter
            return await ApiClient.get<ErrorLog[]>(`/tags/monitor/error-logs`, {
                unresolvedOnly: String(unresolvedOnly),
            });
        },
        staleTime: 30000,
        refetchInterval: 60000,
        refetchIntervalInBackground: false,
    });
};

export const useResolveMonitorError = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: async (logId: string) => {
            return await ApiClient.patch<void, void>(`/tags/monitor/error-logs/${logId}/resolve`, undefined);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['tag-monitor-error-logs']});
        },
    });
};

export interface DeleteMvResult {
    message: string;
    results: {name: string; success: boolean; error?: string}[];
}

export const useDeleteMvs = () => {
    const queryClient = useQueryClient();

    return useMutation<DeleteMvResult, Error, string[]>({
        mutationFn: async (mvNames: string[]) => {
            return await ApiClient.post<{mvNames: string[]}, DeleteMvResult>(`/tags/monitor/mv`, {mvNames});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['tag-monitor-status']});
        },
    });
};

export interface RebuildMvResult {
    success: boolean;
    mvNames: string[];
    tableNames: string[];
}

export const useRebuildMv = () => {
    const queryClient = useQueryClient();

    return useMutation<RebuildMvResult, Error, string>({
        mutationFn: async (tagId: string) => {
            return await ApiClient.put<Record<string, never>, RebuildMvResult>(`/tags/${tagId}/rebuild`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['tag-monitor-status']});
        },
    });
};
