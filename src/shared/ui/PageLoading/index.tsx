'use client';

import React from 'react';
import {Flex, Spin, theme, Typography} from 'antd';

const {Text} = Typography;

interface PageLoadingProps {
    /**
     * Size of the loading spinner
     * @default 'large'
     */
    size?: 'small' | 'default' | 'large';
    /**
     * Optional loading text to display below the spinner
     */
    tip?: string;
    /**
     * Whether to show as full page (100vh) or container height (100%)
     * @default true
     */
    fullPage?: boolean;
    /**
     * Custom background color (uses theme token if not provided)
     */
    backgroundColor?: string;
}

/**
 * A reusable page loading component that follows the theme configuration.
 * Uses Ant Design's theme tokens for consistent styling across light/dark modes.
 *
 * @example
 * // Full page loading
 * <PageLoading />
 *
 * @example
 * // With custom tip
 * <PageLoading tip="Loading data..." />
 *
 * @example
 * // Container height loading
 * <PageLoading fullPage={false} />
 */
export default function PageLoading({
                                        size = 'large',
                                        tip,
                                        fullPage = true,
                                        backgroundColor,
                                    }: PageLoadingProps) {
    const {token} = theme.useToken();

    return (
        <Flex
            vertical
            justify="center"
            align="center"
            gap={token.marginSM}
            style={{
                minHeight: fullPage ? '100vh' : '100%',
                width: '100%',
                backgroundColor: backgroundColor || token.colorBgLayout,
            }}
        >
            <Spin
                size={size}
                style={{
                    color: token.colorPrimary,
                }}
            />
            {tip && (
                <Text
                    type="secondary"
                    style={{
                        color: token.colorTextSecondary,
                        fontSize: token.fontSize,
                    }}
                >
                    {tip}
                </Text>
            )}
        </Flex>
    );
}
