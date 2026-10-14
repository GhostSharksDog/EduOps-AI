'use client';

import React, {Component, ErrorInfo, ReactNode} from 'react';
import {Button, Card, Flex, Result, theme} from 'antd';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * 全局错误边界组件
 * 捕获子组件中的错误并显示友好的错误页面
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State;

    constructor(props: Props) {
        super(props);
        this.state = {hasError: false};
    }

    public static getDerivedStateFromError(error: Error): State {
        return {hasError: true, error};
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    private handleReload = (): void => {
        window.location.reload();
    };

    private handleGoHome = (): void => {
        window.location.href = '/dashboard';
    };

    public render(): ReactNode {
        const {token} = theme.useToken();

        if (this.state.hasError) {
            return this.props.fallback || (
                <Flex
                    align="center"
                    justify="center"
                    style={{
                        minHeight: '100vh',
                        padding: token.paddingLG,
                        background: token.colorBgLayout,
                    }}
                >
                    <Card
                        variant="borderless"
                        style={{
                            maxWidth: 600,
                            boxShadow: token.boxShadow,
                            borderRadius: token.borderRadiusLG,
                        }}
                    >
                        <Result
                            status="error"
                            title="页面出错"
                            subTitle="抱歉，页面发生了未知错误，请尝试刷新页面或返回首页"
                            extra={[
                                <Button
                                    key="reload"
                                    type="primary"
                                    onClick={this.handleReload}
                                >
                                    刷新页面
                                </Button>,
                                <Button
                                    key="home"
                                    onClick={this.handleGoHome}
                                >
                                    返回首页
                                </Button>,
                            ]}
                        />
                    </Card>
                </Flex>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
