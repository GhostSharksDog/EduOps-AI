'use client';

import React, {Suspense} from 'react';
import MonitorView from '@/modules/tag/ui/tags/monitor/components/MonitorView';

const MonitorPage: React.FC = () => {
    return (
        <Suspense fallback={<div>加载中...</div>}>
            <MonitorView />
        </Suspense>
    );
};

export default MonitorPage;
