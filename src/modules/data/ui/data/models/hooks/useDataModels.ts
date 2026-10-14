'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import {clientConfig} from '@/shared/config/client';
import type {
    CreateDataModelDTO,
    DataModelQueryDTO,
    UpdateDataModelDTO
} from '@/modules/data/contracts/schemas/request/data-model/index';
import type {DataModelVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import type {DataModelListVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';

export const useDataModels = (query: DataModelQueryDTO) => {
    return useQuery<DataModelListVO>({
        queryKey: ['dataModels', query],
        queryFn: async () => {
            return ApiClient.get<DataModelListVO>('/data-models', {
                name: query.name,
                status: query.status,
                datasourceId: query.datasourceId,
                page: query.page,
                pageSize: query.pageSize
            });
        },
    });
};

export const useDataModel = (id: string) => {
    return useQuery<DataModelVO>({
        queryKey: ['dataModel', id],
        queryFn: async () => {
            return await ApiClient.get<DataModelVO>(`/data-models/${id}`, {});
        },
        enabled: !!id,
    });
};

export const useCreateDataModel = () => {
    const queryClient = useQueryClient();

    return useMutation<DataModelVO, Error, CreateDataModelDTO>({
        mutationFn: async (data: CreateDataModelDTO) => {
            const payload: CreateDataModelDTO = {
                name: data.name,
                description: data.description || '',
                datasourceId: data.datasourceId,
                tableName: data.tableName || '',
                columns: data.columns || [],
                feature: data.feature,
                ownedBy: clientConfig.system.userId,
                status: DataModelStatus.DRAFT
            };
            return ApiClient.post<CreateDataModelDTO, DataModelVO>('/data-models', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['dataModels']});
        },
    });
};

export const useUpdateDataModel = () => {
    const queryClient = useQueryClient();

    return useMutation<DataModelVO, Error, { id: string; data: UpdateDataModelDTO }>({
        mutationFn: async ({id, data}) => {
            // 处理列数据，保留操作类型
            const processedColumns = (data.columns || []).map(col => ({
                ...col,
                // 显式保留 operation 字段，确保后端正确处理
                operation: col.operation,
            }));

            const payload: UpdateDataModelDTO = {
                id,
                name: data.name,
                description: data.description,
                tableName: data.tableName,
                columns: processedColumns,
                feature: data.feature,
                ownedBy: data.ownedBy
            };
            return ApiClient.put<UpdateDataModelDTO, DataModelVO>(`/data-models/${id}`, payload);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({queryKey: ['dataModels']});
            queryClient.invalidateQueries({queryKey: ['dataModel', variables.id]});
        },
    });
};

export const useDeleteDataModel = () => {
    const queryClient = useQueryClient();

    return useMutation<{ success: boolean; message: string }, Error, string>({
        mutationFn: async (id: string) => {
            return ApiClient.delete<never, { success: boolean; message: string }>(`/data-models/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['dataModels']});
        },
    });
};


export const useActivateDataModel = () => {
    const queryClient = useQueryClient();

    return useMutation<DataModelVO, Error, string>({
        mutationFn: async (id: string) => {
            return ApiClient.patch<undefined, DataModelVO>(`/data-models/${id}/activate`, undefined);
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({queryKey: ['dataModels']});
            queryClient.invalidateQueries({queryKey: ['dataModel', id]});
        },
    });
};

export const useDeactivateDataModel = () => {
    const queryClient = useQueryClient();

    return useMutation<DataModelVO, Error, string>({
        mutationFn: async (id: string) => {
            return ApiClient.patch<undefined, DataModelVO>(`/data-models/${id}/deactivate`, undefined);
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({queryKey: ['dataModels']});
            queryClient.invalidateQueries({queryKey: ['dataModel', id]});
        },
    });
};
