'use client';

import {useState} from 'react';
import {useSettingsStore} from '@/modules/system/client';

export function usePageSize() {
    const storePageSize = useSettingsStore((state) => state.pageSize);
    const [localPageSize, setLocalPageSize] = useState<number | null>(null);

    const pageSize = localPageSize ?? storePageSize;

    const handleSetPageSize = (size: number) => {
        setLocalPageSize(size);
    };

    return {pageSize, setPageSize: handleSetPageSize};
}
