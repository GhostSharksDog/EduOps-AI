'use client';

import {useSettingsStore} from '@/modules/system/client';
import {PAGINATION_DEFAULTS} from '@/shared/ui/dashboard/pagination/defaults';

export function usePaginationDefaults() {
    const {pageSize} = useSettingsStore();
    
    return {
        ...PAGINATION_DEFAULTS,
        defaultPageSize: pageSize,
    };
}

export function getDynamicPageSize(): number {
    if (typeof window === 'undefined') {
        return PAGINATION_DEFAULTS.defaultPageSize;
    }
    try {
        const state = useSettingsStore.getState();
        return state.pageSize;
    } catch {
        return PAGINATION_DEFAULTS.defaultPageSize;
    }
}
