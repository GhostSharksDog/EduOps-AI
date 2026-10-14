'use client';

import React, {Suspense} from 'react';
import DataSourceListView from '@/modules/data/ui/data/sources/components/DataSourceListView';

export default function DataSourceListPage() {
    return (
        <Suspense fallback={<div>加载中...</div>}>
            <DataSourceListView/>
        </Suspense>
    );
}
