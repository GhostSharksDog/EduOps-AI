'use client';

import React from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from '@/shared/lib/react-query';

interface ReactQueryProviderProps {
    children: React.ReactNode;
}

export default function ReactQueryProvider({
                                               children,
                                           }: ReactQueryProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
