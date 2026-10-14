'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import {CreateDataSourceDTO, ListDataSourcesDTO, UpdateDataSourceDTO} from '@/modules/data/contracts/schemas/request/datasource/index';
import {ConnectionTestResultVO, DataSourceListVO, DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {DataSourceStatus} from '@/shared/enums/index';

// 数据源列表查询
export const useDataSources = (query: ListDataSourcesDTO) => {
    return useQuery<DataSourceListVO>({
        queryKey: ['data-sources', query],
        queryFn: async () => {
            return await ApiClient.get<DataSourceListVO>('/data-sources', query);
        },
    });
};

// 单个数据源查询
export const useDataSource = (dataSourceId: string) => {
    return useQuery<DataSourceVO>({
        queryKey: ['data-source', dataSourceId],
        queryFn: async () => {
            return await ApiClient.get<DataSourceVO>(`/data-sources/${dataSourceId}`);
        },
        enabled: !!dataSourceId,
    });
};

// 创建数据源
export const useCreateDataSource = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (dataSourceData: CreateDataSourceDTO) => {
            return await ApiClient.post<CreateDataSourceDTO, void>('/data-sources', dataSourceData);
        },
        onSuccess: () => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['data-sources']});
        },
    });
};

// 更新数据源
export const useUpdateDataSource = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({dataSourceId, dataSourceData}: {
            dataSourceId: string;
            dataSourceData: UpdateDataSourceDTO
        }) => {
            return await ApiClient.put<UpdateDataSourceDTO, void>(`/data-sources/${dataSourceId}`, dataSourceData);
        },
        onSuccess: (_, {dataSourceId}) => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['data-source', dataSourceId]});
            queryClient.invalidateQueries({queryKey: ['data-sources']});
        },
    });
};

// 删除数据源
export const useDeleteDataSource = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (dataSourceId: string) => {
            return await ApiClient.delete<never, void>(`/data-sources/${dataSourceId}`);
        },
        onSuccess: () => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['data-sources']});
        },
    });
};

// 更改数据源状态
export const useChangeDataSourceStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({dataSourceId, status}: { dataSourceId: string; status: DataSourceStatus }) => {
            if (status === DataSourceStatus.ACTIVE) {
                return await ApiClient.post<Record<string, never>, void>(`/data-sources/${dataSourceId}/enable`, {});
            } else {
                return await ApiClient.post<Record<string, never>, void>(`/data-sources/${dataSourceId}/disable`, {});
            }
        },
        onSuccess: (_, {dataSourceId}) => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['data-source', dataSourceId]});
            queryClient.invalidateQueries({queryKey: ['data-sources']});
        },
    });
};

// 测试数据源连接（通过ID）
export const useTestDataSourceConnection = () => {
    return useMutation({
        mutationFn: async ({dataSourceId}: { dataSourceId: string }) => {
            return await ApiClient.get<ConnectionTestResultVO>(`/data-sources/${encodeURIComponent(dataSourceId)}/test-connection`);
        },
    });
};
