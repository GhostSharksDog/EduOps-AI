import React, {Suspense} from 'react';
import PageLoading from '@/shared/ui/PageLoading/index';

export default function SegmentsLayout({
                                           children,
                                       }: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<PageLoading fullPage={false} />}>
            {children}
        </Suspense>
    );
}
