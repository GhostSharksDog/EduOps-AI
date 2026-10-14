'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import type {BitmapTableVO, BitmapTableDetailVO, BitmapTableListVO, BitInfoVO} from '@/shared/schemas/response/bitmap-table/index';

export type {BitmapTableVO, BitmapTableDetailVO, BitInfoVO};

export const useBitmapTables = (filters?: { entityTypeId?: string; entityType?: string; status?: 'ACTIVE' | 'INACTIVE' }) => {
    return useQuery<BitmapTableListVO>({
        queryKey: ['bitmap-tables', filters],
        queryFn: async () => {
            return await ApiClient.get<BitmapTableListVO>('/admin/bitmap-tables', filters);
        },
    });
};

export const useBitmapTableDetail = (tableId: string | undefined) => {
    return useQuery<BitmapTableDetailVO>({
        queryKey: ['bitmap-table', tableId],
        queryFn: async () => {
            return await ApiClient.get<BitmapTableDetailVO>(`/admin/bitmap-tables/${tableId}`);
        },
        enabled: !!tableId,
        staleTime: 0,
    });
};

export const useCreateBitmapTable = () => {
    const queryClient = useQueryClient();

    return useMutation<BitmapTableVO, Error, { entityType: string; entityTypeId: string; totalBits?: number; name?: string; description?: string }>({
        mutationFn: async (values) => {
            return await ApiClient.post<{ entityType: string; entityTypeId: string; totalBits?: number; name?: string; description?: string }, BitmapTableVO>('/admin/bitmap-tables', values);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['bitmap-tables']});
        },
    });
};

export const useToggleBitmapTableStatus = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { tableId: string; newStatus: 'ACTIVE' | 'INACTIVE' }>({
        mutationFn: async ({ tableId, newStatus }) => {
            return await ApiClient.patch<{ status: string }, void>(
                `/admin/bitmap-tables/${tableId}/status`, 
                { status: newStatus }
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['bitmap-tables']});
        },
    });
};

export const useReleaseBitmapBit = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { tableId: string; bitIndex: number }>({
        mutationFn: async ({tableId, bitIndex}) => {
            return await ApiClient.delete<never, void>(`/admin/bitmap-tables/${tableId}/bits/${bitIndex}`);
        },
        onSuccess: (_, {tableId}) => {
            queryClient.invalidateQueries({queryKey: ['bitmap-tables']});
            queryClient.invalidateQueries({queryKey: ['bitmap-table', tableId]});
        },
    });
};

export interface ReleaseBitsResult {
    success: boolean;
    releasedBits: number[];
    failedBit?: number;
    error?: string;
}

export interface AssignBitResult {
    success: boolean;
    assignment?: {
        tagId: string;
        tagName: string;
        bitmapTableId: string;
        bitPosition: number;
    };
    error?: string;
}

export const useAssignBitToTag = () => {
    const queryClient = useQueryClient();

    return useMutation<AssignBitResult, Error, { tableId: string; bitIndex: number; tagId: string }>({
        mutationFn: async ({ tableId, bitIndex, tagId }) => {
            return await ApiClient.post<{ tagId: string }, AssignBitResult>(
                `/admin/bitmap-tables/${tableId}/bits/${bitIndex}/assign`,
                { tagId }
            );
        },
        onSuccess: (_, { tableId }) => {
            queryClient.invalidateQueries({ queryKey: ['bitmap-tables'] });
            queryClient.invalidateQueries({ queryKey: ['bitmap-table', tableId] });
        },
    });
};

export const useUnassignBit = () => {
    const queryClient = useQueryClient();

    return useMutation<{ success: boolean; message: string }, Error, { tableId: string; bitIndex: number }>({
        mutationFn: async ({ tableId, bitIndex }) => {
            return await ApiClient.delete<never, { success: boolean; message: string }>(
                `/admin/bitmap-tables/${tableId}/bits/${bitIndex}/assign`
            );
        },
        onSuccess: (_, { tableId }) => {
            queryClient.invalidateQueries({ queryKey: ['bitmap-tables'] });
            queryClient.invalidateQueries({ queryKey: ['bitmap-table', tableId] });
        },
    });
};

export const useReleaseUnusedBits = () => {
    const queryClient = useQueryClient();

    return useMutation<{ releasedCount: number; releasedBits: number[] }, Error, { tableId: string }>({
        mutationFn: async ({ tableId }) => {
            return await ApiClient.post<void, { releasedCount: number; releasedBits: number[] }>(
                `/admin/bitmap-tables/${tableId}/bits/release-unused`,
                undefined
            );
        },
        onSuccess: (_, { tableId }) => {
            queryClient.invalidateQueries({ queryKey: ['bitmap-tables'] });
            queryClient.invalidateQueries({ queryKey: ['bitmap-table', tableId] });
        },
    });
};

export const useDeleteBitmapTable = () => {
    const queryClient = useQueryClient();

    return useMutation<{ success: boolean; message: string }, Error, string>({
        mutationFn: async (tableId: string) => {
            return await ApiClient.delete<never, { success: boolean; message: string }>(
                `/admin/bitmap-tables/${tableId}`
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bitmap-tables'] });
        },
    });
};
