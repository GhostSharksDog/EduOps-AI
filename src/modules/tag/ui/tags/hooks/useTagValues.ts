'use client';

import {useQuery} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';

export interface TagValueResult {
    entityId: string;
    value: unknown;
    calculatedAt?: string;
}

interface ApiResponse<T> {
    data: T;
}

type BatchValuesResponse = ApiResponse<TagValueResult[]>;
type SingleValueResponse = ApiResponse<TagValueResult>;

export const useTagBatchValues = (
    tagId: string,
    entityIds: string[],
    versionId?: string,
    enabled: boolean = true
) => {
    return useQuery<TagValueResult[]>({
        queryKey: ['tag-values-batch', tagId, entityIds, versionId],
        queryFn: async () => {
            const params = new URLSearchParams({
                entityIds: entityIds.join(','),
            });

            if (versionId) {
                params.append('versionId', versionId);
            }

            const response = await ApiClient.get<BatchValuesResponse>(
                `/tags/${tagId}/values?${params.toString()}`
            );

            return Array.isArray(response?.data) ? response.data : [];
        },
        enabled: enabled && !!tagId && entityIds.length > 0,
        staleTime: 30000,
        retry: 1,
    });
};

export const useTagSingleValue = (
    tagId: string,
    entityId: string,
    versionId?: string,
    enabled: boolean = true
) => {
    return useQuery<TagValueResult | null>({
        queryKey: ['tag-value-single', tagId, entityId, versionId],
        queryFn: async () => {
            let url = `/tags/${tagId}/values/${entityId}`;
            if (versionId) {
                url += `?versionId=${versionId}`;
            }

            const response = await ApiClient.get<SingleValueResponse>(url);
            return response?.data || null;
        },
        enabled: enabled && !!tagId && !!entityId,
        staleTime: 30000,
        retry: 1,
    });
};
