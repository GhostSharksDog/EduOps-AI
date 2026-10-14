'use client';

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import {useSettingsStore} from '@/modules/system/ui/state/settingsStore';

export interface SystemSettings {
    sessionTimeout: number;
    pageSize: number;
    language: string;
    theme: string;
}

export const useSettings = () => {
    const {setPageSize} = useSettingsStore();
    
    return useQuery<SystemSettings>({
        queryKey: ['settings'],
        queryFn: async () => {
            const data = await ApiClient.get<SystemSettings>('/settings');
            setPageSize(data.pageSize);
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });
};

export const useSaveSettings = () => {
    const queryClient = useQueryClient();
    const {setPageSize} = useSettingsStore();

    return useMutation<void, Error, Partial<SystemSettings>>({
        mutationFn: async (values) => {
            await ApiClient.put<Partial<SystemSettings>, void>('/settings', values);
        },
        onSuccess: (_, variables) => {
            if (variables.pageSize) {
                setPageSize(variables.pageSize);
            }
            queryClient.invalidateQueries({queryKey: ['settings']});
        },
    });
};
