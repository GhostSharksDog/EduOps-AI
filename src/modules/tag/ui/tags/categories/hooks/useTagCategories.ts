'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import {type CreateTagCategoryDTO, type UpdateTagCategoryDTO, type MoveTagCategoryDTO, type ReorderTagCategoriesDTO, type BatchDeleteTagCategoriesDTO, type TagCategoryQueryDTO} from '@/modules/tag/contracts/schemas/request/tag-category/index';
import {type TagCategoryListVO, type TagCategoryVO, type BatchDeleteTagCategoriesVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';

// 分类列表查询
export const useTagCategories = (query: TagCategoryQueryDTO) => {
    return useQuery<TagCategoryListVO>({
        queryKey: ['tag-categories', query],
        queryFn: async () => {
            const params: Record<string, unknown> = {
                page: query.page,
                pageSize: query.pageSize,
            };
            if (query.keyword) {
                params.keyword = query.keyword;
            }
            if (query.parentId !== undefined) {
                params.parentId = query.parentId || null;
            }
            return await ApiClient.get<TagCategoryListVO>('/tag-categories', params);
        },
    });
};

// 懒加载子分类
export const useTagCategoryChildren = (parentId: string, enabled: boolean) => {
    return useQuery<TagCategoryListVO>({
        queryKey: ['tag-categories-children', parentId],
        queryFn: async () => {
            return await ApiClient.get<TagCategoryListVO>('/tag-categories', {
                parentId,
                page: 1,
                pageSize: 100,
            });
        },
        enabled,
        staleTime: 60000, // 1分钟内不重新请求
    });
};

// 单个分类查询
export const useTagCategory = (categoryId: string) => {
    return useQuery<TagCategoryVO>({
        queryKey: ['tag-category', categoryId],
        queryFn: async () => {
            return await ApiClient.get<TagCategoryVO>(`/tag-categories/${categoryId}`);
        },
        enabled: !!categoryId,
    });
};

// 创建分类
export const useCreateTagCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (categoryData: CreateTagCategoryDTO) => {
            return await ApiClient.post<CreateTagCategoryDTO, TagCategoryVO>('/tag-categories', categoryData);
        },
        onSuccess: () => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tag-categories']});
            queryClient.invalidateQueries({queryKey: ['tag-categories-simple']});
        },
    });
};

// 更新分类
export const useUpdateTagCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({categoryId, categoryData}: { categoryId: string; categoryData: UpdateTagCategoryDTO }) => {
            return await ApiClient.put<UpdateTagCategoryDTO, TagCategoryVO>(`/tag-categories/${categoryId}`, categoryData);
        },
        onSuccess: (_, {categoryId}) => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tag-category', categoryId]});
            queryClient.invalidateQueries({queryKey: ['tag-categories']});
            queryClient.invalidateQueries({queryKey: ['tag-categories-simple']});
        },
    });
};

// 删除分类
export const useDeleteTagCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (categoryId: string) => {
            return await ApiClient.delete<never, void>(`/tag-categories/${categoryId}`);
        },
        onSuccess: () => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tag-categories']});
            queryClient.invalidateQueries({queryKey: ['tag-categories-simple']});
        },
    });
};

// 移动分类
export const useMoveTagCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: MoveTagCategoryDTO) => {
            return await ApiClient.post<MoveTagCategoryDTO, void>('/tag-categories/move', data);
        },
        onSuccess: () => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tag-categories']});
            queryClient.invalidateQueries({queryKey: ['tag-categories-simple']});
        },
    });
};

// 重新排序分类
export const useReorderTagCategories = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ReorderTagCategoriesDTO) => {
            return await ApiClient.post<ReorderTagCategoriesDTO, void>('/tag-categories/reorder', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['tag-categories']});
            queryClient.invalidateQueries({queryKey: ['tag-categories-simple']});
        },
    });
};

// 批量删除分类
export const useBatchDeleteTagCategories = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: BatchDeleteTagCategoriesDTO) => {
            return await ApiClient.post<BatchDeleteTagCategoriesDTO, BatchDeleteTagCategoriesVO>('/tag-categories/batch-delete', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['tag-categories']});
            queryClient.invalidateQueries({queryKey: ['tag-categories-simple']});
        },
    });
};
