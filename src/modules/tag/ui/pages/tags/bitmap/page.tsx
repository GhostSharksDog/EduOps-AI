'use client';

import React, {Suspense} from 'react';
import BitmapManagementView from '@/modules/tag/ui/tags/bitmap/components/BitmapManagementView';

const BitmapManagementPage: React.FC = () => {
    return (
        <Suspense fallback={<div>加载中...</div>}>
            <BitmapManagementView />
        </Suspense>
    );
};

export default BitmapManagementPage;
