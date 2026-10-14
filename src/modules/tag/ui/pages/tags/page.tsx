'use client';

import React, {Suspense} from 'react';
import TagListView from '@/modules/tag/ui/tags/components/TagListView';

const TagListPage: React.FC = () => {
    return (
        <Suspense fallback={<div>加载中...</div>}>
            <TagListView />
        </Suspense>
    );
};

export default TagListPage;
