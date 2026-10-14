'use client';

import React, {Suspense} from 'react';
import DataModelListContent from '@/modules/data/ui/data/models/components/DataModelListContent';

const DataModelListPage: React.FC = () => {
    return (
        <Suspense fallback={<div>加载中...</div>}>
            <DataModelListContent/>
        </Suspense>
    );
};

export default DataModelListPage;
