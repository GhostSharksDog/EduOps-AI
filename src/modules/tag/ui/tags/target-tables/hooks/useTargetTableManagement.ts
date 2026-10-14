'use client';

import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import type {TargetTableListVO, TargetTableVO} from '@/shared/schemas/response/target-table/index';
import type {CreateTargetTableDTO, UpdateTargetTableDTO, TargetTableQueryDTO} from '@/shared/schemas/request/target-table/index';
import type {TargetTableStatus} from '@/modules/tag/domain/entities/TargetTable';

const BASE_URL = '/tags/target-tables';

export function useTargetTables(query?: TargetTableQueryDTO) {
    const params: Record<string, unknown> = {};
    if (query?.status) params.status = query.status;
    if (query?.entityTypeId) params.entityTypeId = query.entityTypeId;
    if (query?.tagId) params.tagId = query.tagId;
    if (query?.tableName) params.tableName = query.tableName;
    params.page = query?.page ?? 1;
    params.pageSize = query?.pageSize ?? 20;

    return useQuery<TargetTableListVO>({
        queryKey: ['target-tables', query],
        queryFn: async () => {
            return await ApiClient.get<TargetTableListVO>(BASE_URL, params);
        },
    });
}

export function useTargetTableDetail(id: string | undefined) {
    return useQuery<TargetTableVO | null>({
        queryKey: ['target-table', id],
        queryFn: async () => {
            if (!id) return null;
            return await ApiClient.get<TargetTableVO>(`${BASE_URL}/${id}`);
        },
        enabled: !!id,
    });
}

export function useCreateTargetTable() {
    const queryClient = useQueryClient();

    return useMutation<TargetTableVO, Error, CreateTargetTableDTO>({
        mutationFn: async (data) => {
            return await ApiClient.post<CreateTargetTableDTO, TargetTableVO>(BASE_URL, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
        },
    });
}

export function useUpdateTargetTable() {
    const queryClient = useQueryClient();

    return useMutation<TargetTableVO, Error, {id: string; data: UpdateTargetTableDTO}>({
        mutationFn: async ({id, data}) => {
            return await ApiClient.put<UpdateTargetTableDTO, TargetTableVO>(`${BASE_URL}/${id}`, data);
        },
        onSuccess: (_, {id}) => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
            queryClient.invalidateQueries({queryKey: ['target-table', id]});
        },
    });
}

export function useDeleteTargetTable() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: async (id) => {
            await ApiClient.delete<never, void>(`${BASE_URL}/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
        },
    });
}

export function useCreateTable() {
    const queryClient = useQueryClient();

    return useMutation<TargetTableVO, Error, string>({
        mutationFn: async (id) => {
            return await ApiClient.post<Record<string, never>, TargetTableVO>(`${BASE_URL}/${id}/create-table`, {});
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
            queryClient.invalidateQueries({queryKey: ['target-table', id]});
        },
    });
}

export function useActivateTable() {
    const queryClient = useQueryClient();

    return useMutation<TargetTableVO, Error, string>({
        mutationFn: async (id) => {
            return await ApiClient.post<Record<string, never>, TargetTableVO>(`${BASE_URL}/${id}/activate`, {});
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
            queryClient.invalidateQueries({queryKey: ['target-table', id]});
        },
    });
}

export function useDeactivateTable() {
    const queryClient = useQueryClient();

    return useMutation<TargetTableVO, Error, string>({
        mutationFn: async (id) => {
            return await ApiClient.post<Record<string, never>, TargetTableVO>(`${BASE_URL}/${id}/deactivate`, {});
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
            queryClient.invalidateQueries({queryKey: ['target-table', id]});
        },
    });
}

export function useSyncStatus() {
    const queryClient = useQueryClient();

    return useMutation<TargetTableVO, Error, string>({
        mutationFn: async (id) => {
            return await ApiClient.post<Record<string, never>, TargetTableVO>(`${BASE_URL}/${id}/sync-status`, {});
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
            queryClient.invalidateQueries({queryKey: ['target-table', id]});
        },
    });
}

export function useSyncAllStatus() {
    const queryClient = useQueryClient();

    return useMutation<{ synced: number; missing: number }, Error, void>({
        mutationFn: async () => {
            return await ApiClient.post<Record<string, never>, { synced: number; missing: number }>(`${BASE_URL}/sync-all`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['target-tables']});
        },
    });
}
