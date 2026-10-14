'use client';

import {useMutation} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import type {DDLGenerateOptions, DDLGenerateResult} from '@/platform/ddl/index';

interface DDLPreviewResponse {
    success: boolean;
    data: DDLGenerateResult;
}

const BASE_URL = '/tags/target-tables';

export function useDDLPreview() {
    const {mutate, data, isPending, error} = useMutation<DDLGenerateResult, Error, DDLGenerateOptions>({
        mutationFn: async (options) => {
            const response = await ApiClient.post<DDLGenerateOptions, DDLPreviewResponse>(
                `${BASE_URL}/ddl-preview`,
                options
            );
            return response.data;
        },
    });

    return {
        mutateDDLPreview: mutate,
        data: data ?? null,
        isPending,
        error,
    };
}
