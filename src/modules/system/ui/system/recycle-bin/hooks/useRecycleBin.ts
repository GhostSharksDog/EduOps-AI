'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import {ListRecycleBinItemsQueryDTO, type RestoreItemDTO, type BatchOperationDTO} from '@/modules/system/contracts/schemas/request/recycle-bin/index';
import {RecycleBinItemListVO} from '@/modules/system/contracts/schemas/response/recycle-bin/index';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

// 获取回收站列表
export const useRecycleBinItems = (query: ListRecycleBinItemsQueryDTO) => {
    return useQuery<RecycleBinItemListVO>({
        queryKey: ['recycleBin', query],
        queryFn: async () => {
            const params = {
                ...query,
                keyword: query.keyword || undefined,
                type: query.type,
                deletedFrom: query.deletedFrom,
                deletedTo: query.deletedTo,
            };
            return await ApiClient.get<RecycleBinItemListVO>('/recycle-bin', params);
        },
    });
};

// 恢复单个项目
export const useRestoreItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: RestoreItemDTO) => {
            return await ApiClient.post<{
                type: RecycleBinItemType
            }, void>(`/recycle-bin/${params.id}/restore`, {type: params.type});
        },
        onSuccess: () => {
            // 失效回收站列表缓存
            queryClient.invalidateQueries({queryKey: ['recycleBin']});
        },
    });
};

// 永久删除单个项目
export const usePermanentDeleteItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: RestoreItemDTO) => {
            return await ApiClient.delete<never, void>(`/recycle-bin/${params.id}?type=${params.type}`);
        },
        onSuccess: () => {
            // 失效回收站列表缓存
            queryClient.invalidateQueries({queryKey: ['recycleBin']});
        },
    });
};

// 批量恢复
export const useBatchRestore = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: BatchOperationDTO) => {
            return await ApiClient.post<{
                ids: Array<{ id: string; type: RecycleBinItemType }>
            }, void>('/recycle-bin/batch-restore', {ids: params.ids});
        },
        onSuccess: () => {
            // 失效回收站列表缓存
            queryClient.invalidateQueries({queryKey: ['recycleBin']});
        },
    });
};

// 批量永久删除
export const useBatchPermanentDelete = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: BatchOperationDTO) => {
            return await ApiClient.delete<{
                ids: Array<{ id: string; type: RecycleBinItemType }>
            }, void>('/recycle-bin/batch', {ids: params.ids});
        },
        onSuccess: () => {
            // 失效回收站列表缓存
            queryClient.invalidateQueries({queryKey: ['recycleBin']});
        },
    });
};
