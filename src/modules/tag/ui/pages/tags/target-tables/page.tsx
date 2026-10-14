'use client';

import React, {Suspense} from 'react';
import TargetTableView from '@/modules/tag/ui/tags/target-tables/components/TargetTableView';

const TargetTableManagementPage: React.FC = () => {
    return (
        <Suspense fallback={<div>加载中...</div>}>
            <TargetTableView />
        </Suspense>
    );
};

export default TargetTableManagementPage;
