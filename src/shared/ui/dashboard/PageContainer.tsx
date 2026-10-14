'use client';

import React from 'react';
import {Flex, theme} from 'antd';

interface PageContainerProps {
    children: React.ReactNode;
    gap?: number;
    minHeight?: string | number;
}

const PageContainer: React.FC<PageContainerProps> = ({
    children,
    gap,
    minHeight = '100vh',
}) => {
    const {token} = theme.useToken();

    return (
        <Flex
            vertical
            style={{minHeight}}
            gap={gap ?? token.marginLG}
        >
            {children}
        </Flex>
    );
};

export default PageContainer;
