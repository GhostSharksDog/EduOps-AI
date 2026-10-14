import React from 'react';
import {Badge, Card, Flex, Typography, Skeleton} from 'antd';
import {CheckCircleOutlined, DatabaseOutlined, ExclamationCircleOutlined,} from '@ant-design/icons';
import {useDataSources} from '@/modules/overview/client';
import type {DataSourceVO} from '@/modules/data/contracts';

const {Text} = Typography;

interface DataSourceOverviewProps {
    className?: string;
}

const DataSourceOverview: React.FC<DataSourceOverviewProps> = ({className}) => {
    const {data, isLoading} = useDataSources(1, 3);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <CheckCircleOutlined style={{color: '#52c41a'}}/>;
            case 'inactive':
                return <ExclamationCircleOutlined style={{color: '#faad14'}}/>;
            case 'error':
                return <ExclamationCircleOutlined style={{color: '#ff4d4f'}}/>;
            default:
                return <CheckCircleOutlined style={{color: '#52c41a'}}/>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge status="success" text="正常"/>;
            case 'inactive':
                return <Badge status="warning" text="延迟"/>;
            case 'error':
                return <Badge status="error" text="异常"/>;
            default:
                return <Badge status="success" text="正常"/>;
        }
    };

    if (isLoading || !data?.items) {
        return (
            <Card
                title="数据源概览"
                extra={<Text type="secondary">共 0 个</Text>}
                className={className}
                styles={{
                    body: {
                        padding: '16px',
                    },
                }}
            >
                <Flex vertical gap={12}>
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} active paragraph={{ rows: 2 }} />
                    ))}
                </Flex>
            </Card>
        );
    }

    return (
        <Card
            title="数据源概览"
            extra={<Text type="secondary">共 {data.totalCount || data.items.length} 个</Text>}
            className={className}
            styles={{
                body: {
                    padding: '16px',
                },
            }}
        >
            <Flex vertical gap={12}>
                {data.items.map((source: DataSourceVO) => (
                    <Flex
                        key={source.id}
                        justify="space-between"
                        align="center"
                        style={{
                            padding: '12px',
                            background: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: 8,
                        }}
                    >
                        <Flex vertical gap={4}>
                            <Flex align="center" gap={8}>
                                <DatabaseOutlined style={{color: '#1677ff'}}/>
                                <Text strong>{source.name}</Text>
                                {getStatusIcon(source.status)}
                            </Flex>
                            <Flex gap={12}>
                                <Text type="secondary" style={{fontSize: 12}}>
                                    {source.type}
                                </Text>
                                <Text type="secondary" style={{fontSize: 12}}>
                                    {source.recordCount ? `${(source.recordCount / 10000).toFixed(1)}万条` : '-'}
                                </Text>
                            </Flex>
                        </Flex>
                        <Flex vertical align="flex-end" gap={2}>
                            {getStatusBadge(source.status)}
                            <Text type="secondary" style={{fontSize: 12}}>
                                {source.updateTime ? new Date(source.updateTime).toLocaleString('zh-CN') : '-'}
                            </Text>
                        </Flex>
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default DataSourceOverview;
