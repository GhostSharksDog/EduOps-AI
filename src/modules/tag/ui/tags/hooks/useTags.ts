'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import {ListTagsQuery} from '@/modules/tag/contracts/queries/index';
import {type CreateTagDTO, type UpdateTagDTO} from '@/modules/tag/contracts/schemas/request/tag/index';
import {type TagVO, type TagVersionVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {type TagListVO} from '@/modules/tag/contracts/schemas/response/tag/tagListSchema';
import {type TagVersionListVO} from '@/modules/tag/contracts/schemas/response/tag/tagVersionListSchema';
import {type CreateTagVersionDTO} from '@/modules/tag/contracts/schemas/request/tag/index';

// 标签列表查询
export const useTags = (query: ListTagsQuery) => {
    return useQuery<TagListVO>({
        queryKey: ['tags', query],
        queryFn: async () => {
            return await ApiClient.get<TagListVO>('/tags', query);
        },
    });
};

// 单个标签查询
export const useTag = (tagId: string) => {
    return useQuery<TagVO>({
        queryKey: ['tag', tagId],
        queryFn: async () => {
            return await ApiClient.get<TagVO>(`/tags/${tagId}`);
        },
        enabled: !!tagId,
    });
};

// 创建标签
export const useCreateTag = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (tagData: CreateTagDTO) => {
            return await ApiClient.post<CreateTagDTO, void>('/tags', tagData);
        },
        onSuccess: () => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tags']});
        },
    });
};

// 更新标签
export const useUpdateTag = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({tagId, tagData}: { tagId: string; tagData: UpdateTagDTO }) => {
            return await ApiClient.put<UpdateTagDTO, void>(`/tags/${tagId}`, tagData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['tags']});
            queryClient.invalidateQueries({queryKey: ['bitmap-table']});
            queryClient.invalidateQueries({queryKey: ['bitmap-tables']});
        },
    });
};

// 删除标签
export const useDeleteTag = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (tagId: string) => {
            return await ApiClient.delete<never, void>(`/tags/${tagId}`);
        },
        onSuccess: () => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tags']});
        },
    });
};

// 激活标签
export const useActivateTag = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (tagId: string) => {
            return await ApiClient.put<Record<string, never>, void>(`/tags/${tagId}/activate`, {});
        },
        onSuccess: (_, tagId) => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tag', tagId]});
            queryClient.invalidateQueries({queryKey: ['tags']});
        },
    });
};

// 停用标签
export const useDeactivateTag = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({tagId, releaseBit, reason}: {
            tagId: string;
            releaseBit?: boolean;
            reason?: string;
        }) => {
            return await ApiClient.put<{releaseBit?: boolean; reason?: string}, void>(
                `/tags/${tagId}/deactivate`,
                {releaseBit: releaseBit ?? false, reason}
            );
        },
        onSuccess: (_, {tagId}) => {
            queryClient.invalidateQueries({queryKey: ['tag', tagId]});
            queryClient.invalidateQueries({queryKey: ['tags']});
        },
    });
};

// 废弃标签
export const useDeprecateTag = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({tagId, reason}: {tagId: string; reason?: string}) => {
            return await ApiClient.post<{reason?: string}, void>(
                `/tags/${tagId}/deprecate`,
                {reason}
            );
        },
        onSuccess: (_, {tagId}) => {
            queryClient.invalidateQueries({queryKey: ['tag', tagId]});
            queryClient.invalidateQueries({queryKey: ['tags']});
        },
    });
};

// 标签版本相关hooks
export const useTagVersions = (tagId: string) => {
    return useQuery<TagVersionListVO>({
        queryKey: ['tag-versions', tagId],
        queryFn: async () => {
            return await ApiClient.get<TagVersionListVO>(`/tags/${tagId}/versions`, {page: 1, pageSize: 100});
        },
        enabled: !!tagId,
    });
};

export const useCurrentTagVersion = (tagId: string) => {
    return useQuery<TagVersionVO>({
        queryKey: ['tag-current-version', tagId],
        queryFn: async () => {
            return await ApiClient.get<TagVersionVO>(`/tags/${tagId}/versions/current`);
        },
        enabled: !!tagId,
    });
};

export const useCreateTagVersion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({tagId, versionData}: { tagId: string; versionData: CreateTagVersionDTO }) => {
            return await ApiClient.post<CreateTagVersionDTO, TagVersionVO>(`/tags/${tagId}/versions`, versionData);
        },
        onSuccess: (_, {tagId}) => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tag-versions', tagId]});
            queryClient.invalidateQueries({queryKey: ['tag-current-version', tagId]});
        },
    });
};

export const useSetCurrentTagVersion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({tagId, versionId}: { tagId: string; versionId: string }) => {
            return await ApiClient.put<{ versionId: string }, TagVersionVO>(`/tags/${tagId}/versions/current`, {versionId});
        },
        onSuccess: (_, {tagId}) => {
            // 失效相关查询缓存
            queryClient.invalidateQueries({queryKey: ['tag-versions', tagId]});
            queryClient.invalidateQueries({queryKey: ['tag-current-version', tagId]});
        },
    });
};

export const useResumeTag = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (tagId: string) => {
            return await ApiClient.post<Record<string, never>, void>(`/tags/${tagId}/resume`, {});
        },
        onSuccess: (_, tagId) => {
            queryClient.invalidateQueries({queryKey: ['tag', tagId]});
            queryClient.invalidateQueries({queryKey: ['tags']});
        },
    });
};

export const useTagCategoriesSimple = () => {
    return useQuery<{items: import('@/modules/tag/contracts/schemas/response/tag-category/index').TagCategoryVO[]}>({
        queryKey: ['tag-categories-simple'],
        queryFn: async () => {
            return await ApiClient.get<{items: import('@/modules/tag/contracts/schemas/response/tag-category/index').TagCategoryVO[]}>('/tag-categories', {
                page: 1,
                pageSize: 1000,
            });
        },
        staleTime: 5 * 60 * 1000,
    });
};

// 更新标签规则（创建新版本）
export const useUpdateTagRule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({tagId, ruleData}: { tagId: string; ruleData: {
            ruleType: string;
            ruleContent?: string;
            dataModelIds?: string[];
        } }) => {
            return await ApiClient.post<typeof ruleData, { success: boolean; message: string }>(
                `/tags/${tagId}/rule`,
                ruleData
            );
        },
        onSuccess: (_, {tagId}) => {
            queryClient.invalidateQueries({queryKey: ['tag', tagId]});
            queryClient.invalidateQueries({queryKey: ['tags']});
            queryClient.invalidateQueries({queryKey: ['tag-versions', tagId]});
            queryClient.invalidateQueries({queryKey: ['tag-current-version', tagId]});
        },
    });
};
