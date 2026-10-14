'use client';

import React, {useEffect, useState} from 'react';
import {Button, Card, Flex, Typography, theme} from 'antd';
import {HomeOutlined, ExclamationCircleOutlined} from '@ant-design/icons';
import {useRouter} from 'next/navigation';
import styles from './not-found.module.css';

const {Title, Paragraph} = Typography;

const NotFoundPage: React.FC = () => {
    const router = useRouter();
    const {token} = theme.useToken();
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (countdown <= 0) {
            router.push('/dashboard');
        }
    }, [countdown, router]);

    const handleGoHome = () => {
        router.push('/dashboard');
    };

    const primaryButtonStyle: React.CSSProperties = {
        height: '44px',
        paddingInline: '24px',
        fontSize: '15px',
        fontWeight: 500,
        borderRadius: token.borderRadiusLG,
        background: `linear-gradient(135deg, ${token.colorInfo} 0%, ${token.colorInfoHover} 100%)`,
        border: 'none',
        boxShadow: token.boxShadow,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    };

    return (
        <div className={styles.container}>
            <Card
                variant="borderless"
                style={{
                    width: '100%',
                    maxWidth: 600,
                    boxShadow: token.boxShadow,
                    borderRadius: token.borderRadiusLG,
                }}
            >
                <Flex vertical align="center" justify="center">
                    <div className={styles.iconContainer}>
                        <ExclamationCircleOutlined
                            style={{
                                fontSize: '48px',
                                color: token.colorWhite,
                            }}
                        />
                    </div>

                    <Title level={2} style={{margin: 0, color: token.colorTextHeading}}>
                        页面未找到
                    </Title>

                    <Paragraph
                        style={{
                            margin: `${token.margin}px 0 0`,
                            color: token.colorTextSecondary,
                            textAlign: 'center',
                            maxWidth: '400px',
                        }}
                    >
                        您访问的页面不存在或已被移除，请检查URL是否正确或返回首页继续浏览。
                    </Paragraph>

                    <Flex className={styles.buttonGroup}>
                        <Button
                            icon={<HomeOutlined />}
                            onClick={handleGoHome}
                            style={primaryButtonStyle}
                        >
                            返回首页
                        </Button>
                    </Flex>

                    <Paragraph
                        type="secondary"
                        className={styles.countdown}
                        style={{margin: `${token.margin}px 0 0`}}
                    >
                        {countdown > 0 ? `将在 ${countdown} 秒后自动跳转到首页...` : '正在跳转到首页...'}
                    </Paragraph>
                </Flex>
            </Card>
        </div>
    );
};

export default NotFoundPage;
